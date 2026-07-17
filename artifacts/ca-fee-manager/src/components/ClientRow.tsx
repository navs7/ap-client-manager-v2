import { useState, useEffect, useRef } from 'react';
import { Client, updateClient } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Ban, Pencil, CheckCheck } from 'lucide-react';
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
  const [feesReceivedEditing, setFeesReceivedEditing] = useState(false);

  const quotedTimeoutRef = useRef<NodeJS.Timeout>();
  const receivedTimeoutRef = useRef<NodeJS.Timeout>();
  const commentsTimeoutRef = useRef<NodeJS.Timeout>();

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

  // ✓ button: copy quoted fees → fees received
  async function handleCheckFees() {
    const val = quotedFees;
    setFeesReceived(val);
    setFeesReceivedEditing(false);
    const num = val === '' ? null : Number(val);
    await updateField('feesReceived', num);
    toast.success('Fees received set to quoted amount');
  }

  // Confirm edit mode value
  function handleReceivedEditDone() {
    setFeesReceivedEditing(false);
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
    <div
      className="flex flex-col gap-3 p-4 border border-border rounded-lg bg-card hover:bg-accent/5 transition-colors status-transition row-enter"
      data-testid={`client-row-${client.id}`}
    >
      {/* Top row: name | quoted | received | action buttons */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1.4fr_auto] gap-3 items-end">
        {/* Name */}
        <div className="flex items-center h-9">
          <div className="font-semibold text-base">{client.name}</div>
        </div>

        {/* Quoted Fees */}
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

        {/* Fees Received — check/edit mode */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Fees Received</label>
          {feesReceivedEditing ? (
            <div className="flex gap-1">
              <Input
                type="number"
                value={feesReceived}
                onChange={(e) => handleReceivedChange(e.target.value)}
                placeholder="0"
                className="font-mono"
                autoFocus
                data-testid={`input-received-${client.id}`}
              />
              <Button
                size="icon"
                variant="outline"
                onClick={handleReceivedEditDone}
                className="shrink-0 h-9 w-9 text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950"
                title="Done"
              >
                <CheckCheck className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-1">
              {/* ✓ button: fill received from quoted */}
              <Button
                size="icon"
                variant="outline"
                onClick={handleCheckFees}
                disabled={!quotedFees}
                className="shrink-0 h-9 w-9 text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950"
                title="Set fees received = quoted fees"
                data-testid={`button-check-fees-${client.id}`}
              >
                <Check className="w-4 h-4" />
              </Button>
              {/* Read-only display */}
              <div className="flex-1 h-9 px-3 flex items-center font-mono text-sm bg-muted/40 rounded-md border border-border text-foreground min-w-0">
                {feesReceived || <span className="text-muted-foreground">—</span>}
              </div>
              {/* Edit button */}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setFeesReceivedEditing(true)}
                className="shrink-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                title="Edit fees received"
                data-testid={`button-edit-received-${client.id}`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-end gap-1.5">
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
          {/* No Service — icon only to save space */}
          <Button
            size="icon"
            variant="outline"
            onClick={handleNoService}
            disabled={updating}
            title="No Service"
            className="h-8 w-8 shrink-0"
            data-testid={`button-no-service-${client.id}`}
          >
            <Ban className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Bottom row: comments textarea full width */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Comments</label>
        <textarea
          value={comments}
          onChange={(e) => handleCommentsChange(e.target.value)}
          placeholder="Add notes..."
          rows={3}
          className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[72px]"
          data-testid={`input-comments-${client.id}`}
        />
      </div>
    </div>
  );
}
