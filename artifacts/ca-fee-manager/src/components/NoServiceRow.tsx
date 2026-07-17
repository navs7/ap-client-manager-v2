import { useState } from 'react';
import { Client, updateClient } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Undo2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface NoServiceRowProps {
  client: Client;
  uid: string;
  fyId: string;
}

export function NoServiceRow({ client, uid, fyId }: NoServiceRowProps) {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  async function handleUndo() {
    setUpdating(true);
    try {
      await updateClient(uid, fyId, client.id, { status: 'pending' });
      toast.success(`${client.name} moved back to pending`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
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

        <span className="font-medium text-sm flex-1 truncate text-muted-foreground">{client.name}</span>

        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            onClick={handleUndo}
            disabled={updating}
            className="h-7 px-2.5 text-xs"
            data-testid={`button-undo-no-service-${client.id}`}
          >
            <Undo2 className="w-3.5 h-3.5 mr-1" />
            Undo
          </Button>
        </div>
      </div>

      {/* Expanded Body — always shown when open */}
      {open && (
        <div className="border-t border-border px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Comments</p>
          {client.comments
            ? <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.comments}</p>
            : <p className="text-xs text-muted-foreground/60 italic">&lt;no comment&gt;</p>}
        </div>
      )}
    </div>
  );
}
