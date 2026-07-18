import { useState } from 'react';
import { Client, updateClient } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Undo2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { HistoryLog } from './HistoryLog';

interface PaidClientRowProps {
  client: Client;
  uid: string;
  fyId: string;
}

function formatINR(amount: number | null) {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

export function PaidClientRow({ client, uid, fyId }: PaidClientRowProps) {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  async function handleUndo() {
    setUpdating(true);
    try {
      const entry = { id: crypto.randomUUID(), at: new Date().toISOString(), action: 'Moved back to Pending' };
      await updateClient(uid, fyId, client.id, {
        status: 'pending',
        paymentType: null,
        history: [...(client.history || []), entry],
      });
      toast.success(`${client.name} moved back to pending`);
    } catch { toast.error('Failed to update status'); }
    finally { setUpdating(false); }
  }

  return (
    <div
      className="border border-accent/20 rounded-lg bg-accent/5 overflow-hidden transition-shadow hover:shadow-sm status-transition row-enter"
      data-testid={`paid-client-row-${client.id}`}
    >
      {/* Collapsed Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-accent/10 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-muted-foreground shrink-0">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <span className="font-semibold text-sm flex-1 truncate">{client.name}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {formatINR(client.quotedFees)}
          </span>
          <span className="hidden sm:inline text-xs font-mono font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded">
            {formatINR(client.feesReceived)}
          </span>
        </div>
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm" variant="outline" onClick={handleUndo} disabled={updating}
            className="h-7 px-2.5 text-xs"
            data-testid={`button-undo-paid-${client.id}`}
          >
            <Undo2 className="w-3.5 h-3.5 mr-1" />Undo
          </Button>
        </div>
      </div>

      {/* Expanded Body */}
      {open && (
        <div className="border-t border-accent/20 px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Quoted Fees</p>
              <p className="text-sm font-mono font-medium">{formatINR(client.quotedFees)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Fees Received</p>
              <p className="text-sm font-mono font-semibold text-accent">{formatINR(client.feesReceived)}</p>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Comments</p>
            {client.comments
              ? <p className="text-sm text-foreground whitespace-pre-wrap">{client.comments}</p>
              : <p className="text-xs text-muted-foreground/60 italic">&lt;no comment&gt;</p>}
          </div>
          <div className="border-t border-accent/20 pt-3">
            <HistoryLog history={client.history} />
          </div>
        </div>
      )}
    </div>
  );
}
