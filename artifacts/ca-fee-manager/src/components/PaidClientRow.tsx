import { useState } from 'react';
import { Client, updateClient } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Undo2, IndianRupee } from 'lucide-react';
import { toast } from 'sonner';

interface PaidClientRowProps {
  client: Client;
  uid: string;
  fyId: string;
}

export function PaidClientRow({ client, uid, fyId }: PaidClientRowProps) {
  const [updating, setUpdating] = useState(false);

  async function handleUndo() {
    setUpdating(true);
    try {
      await updateClient(uid, fyId, client.id, { status: 'pending' });
      toast.success(`${client.name} moved back to pending`);
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-3 p-4 border border-accent/20 rounded-lg bg-accent/5 status-transition row-enter" data-testid={`paid-client-row-${client.id}`}>
      <div className="flex items-center">
        <div className="font-semibold text-base">{client.name}</div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Quoted Fees</label>
        <div className="flex items-center gap-1 text-sm font-mono text-foreground">
          <IndianRupee className="w-3.5 h-3.5" />
          <span>{formatCurrency(client.quotedFees)}</span>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Fees Received</label>
        <div className="flex items-center gap-1 text-sm font-mono font-semibold text-accent">
          <IndianRupee className="w-3.5 h-3.5" />
          <span>{formatCurrency(client.feesReceived)}</span>
        </div>
      </div>

      <div className="flex items-end">
        <Button
          size="sm"
          variant="outline"
          onClick={handleUndo}
          disabled={updating}
          data-testid={`button-undo-paid-${client.id}`}
        >
          <Undo2 className="w-4 h-4 mr-1" />
          Undo
        </Button>
      </div>
    </div>
  );
}
