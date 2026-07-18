import { useState } from 'react';
import { Client, updateClient } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Undo2, ChevronDown, ChevronRight, CalendarX } from 'lucide-react';
import { toast } from 'sonner';
import { HistoryLog } from './HistoryLog';
import { CommentInput } from './CommentInput';

interface NoServiceRowProps {
  client: Client;
  uid: string;
  fyId: string;
}

export function NoServiceRow({ client, uid, fyId }: NoServiceRowProps) {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  async function handleAddComment(text: string) {
    const entry = { id: crypto.randomUUID(), at: new Date().toISOString(), action: `Note: ${text}` };
    await updateClient(uid, fyId, client.id, { history: [...(client.history || []), entry] });
  }

  async function handleUndo() {
    setUpdating(true);
    try {
      const entry = { id: crypto.randomUUID(), at: new Date().toISOString(), action: 'Moved back to Pending' };
      await updateClient(uid, fyId, client.id, {
        status: 'pending',
        history: [...(client.history || []), entry],
      });
      toast.success(`${client.name} moved back to pending`);
    } catch { toast.error('Failed to update status'); }
    finally { setUpdating(false); }
  }

  return (
    <div
      className="border border-border rounded-lg bg-muted/20 overflow-hidden transition-shadow hover:shadow-sm status-transition row-enter"
      data-testid={`no-service-row-${client.id}`}
    >
      {/* Collapsed Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-muted/40 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-muted-foreground shrink-0">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <CalendarX className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium text-sm flex-1 truncate text-muted-foreground">{client.name}</span>
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm" variant="outline" onClick={handleUndo} disabled={updating}
            className="h-7 px-2.5 text-xs"
            data-testid={`button-undo-no-service-${client.id}`}
          >
            <Undo2 className="w-3.5 h-3.5 mr-1" />Undo
          </Button>
        </div>
      </div>

      {/* Expanded Body */}
      {open && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          <CommentInput onSubmit={handleAddComment} />
          <HistoryLog history={client.history} />
        </div>
      )}
    </div>
  );
}
