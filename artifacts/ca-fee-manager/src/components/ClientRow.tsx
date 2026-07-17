import { useState, useEffect, useRef } from 'react';
import { Client, updateClient } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Ban } from 'lucide-react';
import { toast } from 'sonner';

interface ClientRowProps {
  client: Client;
  uid: string;
  fyId: string;
}

export function ClientRow({ client, uid, fyId }: ClientRowProps) {
  const [quotedFees, setQuotedFees] = useState(client.quotedFees?.toString() || '');
  const [feesReceived, setFeesReceived] = useState(client.feesReceived?.toString() || '');
  const [comments, setComments] = useState(client.comments || '');
  const [updating, setUpdating] = useState(false);

  const quotedTimeoutRef = useRef<NodeJS.Timeout>();
  const receivedTimeoutRef = useRef<NodeJS.Timeout>();
  const commentsTimeoutRef = useRef<NodeJS.Timeout>();

  // Sync with prop changes
  useEffect(() => {
    setQuotedFees(client.quotedFees?.toString() || '');
    setFeesReceived(client.feesReceived?.toString() || '');
    setComments(client.comments || '');
  }, [client.quotedFees, client.feesReceived, client.comments]);

  async function updateField(field: string, value: any) {
    try {
      await updateClient(uid, fyId, client.id, { [field]: value });
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Failed to update');
    }
  }

  function handleQuotedChange(value: string) {
    setQuotedFees(value);
    if (quotedTimeoutRef.current) clearTimeout(quotedTimeoutRef.current);
    quotedTimeoutRef.current = setTimeout(() => {
      const num = value === '' ? null : Number(value);
      if (value !== '' && isNaN(num as number)) return;
      updateField('quotedFees', num);
    }, 600);
  }

  function handleReceivedChange(value: string) {
    setFeesReceived(value);
    if (receivedTimeoutRef.current) clearTimeout(receivedTimeoutRef.current);
    receivedTimeoutRef.current = setTimeout(() => {
      const num = value === '' ? null : Number(value);
      if (value !== '' && isNaN(num as number)) return;
      updateField('feesReceived', num);
    }, 600);
  }

  function handleCommentsChange(value: string) {
    setComments(value);
    if (commentsTimeoutRef.current) clearTimeout(commentsTimeoutRef.current);
    commentsTimeoutRef.current = setTimeout(() => {
      updateField('comments', value || null);
    }, 600);
  }

  async function handleMarkPaid() {
    setUpdating(true);
    try {
      await updateClient(uid, fyId, client.id, { status: 'paid' });
      toast.success(`${client.name} marked as paid`);
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  }

  async function handleNoService() {
    setUpdating(true);
    try {
      await updateClient(uid, fyId, client.id, { status: 'no_service' });
      toast.success(`${client.name} marked as no service`);
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_2fr_auto] gap-3 p-4 border border-border rounded-lg bg-card hover:bg-accent/5 transition-colors status-transition row-enter" data-testid={`client-row-${client.id}`}>
      <div className="flex items-center">
        <div className="font-semibold text-base">{client.name}</div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Quoted Fees</label>
        <Input
          type="number"
          value={quotedFees}
          onChange={(e) => handleQuotedChange(e.target.value)}
          placeholder="0"
          className="font-mono"
          data-testid={`input-quoted-${client.id}`}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Fees Received</label>
        <Input
          type="number"
          value={feesReceived}
          onChange={(e) => handleReceivedChange(e.target.value)}
          placeholder="0"
          className="font-mono"
          data-testid={`input-received-${client.id}`}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Comments</label>
        <Input
          type="text"
          value={comments}
          onChange={(e) => handleCommentsChange(e.target.value)}
          placeholder="Add notes..."
          data-testid={`input-comments-${client.id}`}
        />
      </div>

      <div className="flex items-end gap-2">
        <Button
          size="sm"
          onClick={handleMarkPaid}
          disabled={updating}
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
          data-testid={`button-mark-paid-${client.id}`}
        >
          <Check className="w-4 h-4 mr-1" />
          Paid
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleNoService}
          disabled={updating}
          data-testid={`button-no-service-${client.id}`}
        >
          <Ban className="w-4 h-4 mr-1" />
          No Service
        </Button>
      </div>
    </div>
  );
}
