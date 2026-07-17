import { useState, useEffect, useRef } from 'react';
import { Client, updateClient } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Ban, Pencil, CheckCheck, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface ClientRowProps {
  client: Client;
  uid: string;
  fyId: string;
}

// ── Recent fees stored in localStorage ──────────────────────────────
function getRecentFees(): number[] {
  try {
    const stored = localStorage.getItem('recentQuotedFees');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}
function addRecentFee(fee: number) {
  const recent = getRecentFees().filter((f) => f !== fee);
  recent.unshift(fee);
  localStorage.setItem('recentQuotedFees', JSON.stringify(recent.slice(0, 4)));
}
function formatINR(amount: number | null) {
  if (amount === null || amount === undefined) return null;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ClientRow({ client, uid, fyId }: ClientRowProps) {
  const [open, setOpen] = useState(false);
  const [quotedFees, setQuotedFees] = useState(client.quotedFees?.toString() || '');
  const [feesReceived, setFeesReceived] = useState(client.feesReceived?.toString() || '');
  const [comments, setComments] = useState(client.comments || '');
  const [updating, setUpdating] = useState(false);
  const [feesReceivedEditing, setFeesReceivedEditing] = useState(false);
  const [recentFees, setRecentFees] = useState<number[]>([]);

  const quotedTimeoutRef = useRef<NodeJS.Timeout>();
  const receivedTimeoutRef = useRef<NodeJS.Timeout>();
  const commentsTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setQuotedFees(client.quotedFees?.toString() || '');
    setFeesReceived(client.feesReceived?.toString() || '');
    setComments(client.comments || '');
  }, [client.quotedFees, client.feesReceived, client.comments]);

  // Load recent fees when card opens
  useEffect(() => {
    if (open) setRecentFees(getRecentFees());
  }, [open]);

  async function updateField(field: string, value: any) {
    try {
      await updateClient(uid, fyId, client.id, { [field]: value });
    } catch {
      toast.error('Failed to update');
    }
  }

  function handleQuotedChange(value: string) {
    setQuotedFees(value);
    if (quotedTimeoutRef.current) clearTimeout(quotedTimeoutRef.current);
    quotedTimeoutRef.current = setTimeout(() => {
      const num = value === '' ? null : Number(value);
      if (value !== '' && isNaN(num as number)) return;
      if (num !== null) {
        addRecentFee(num);
        setRecentFees(getRecentFees());
      }
      updateField('quotedFees', num);
    }, 600);
  }

  function handleQuotedPill(fee: number) {
    const val = fee.toString();
    setQuotedFees(val);
    addRecentFee(fee);
    setRecentFees(getRecentFees());
    updateField('quotedFees', fee);
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

  async function handleCheckFees() {
    setFeesReceived(quotedFees);
    setFeesReceivedEditing(false);
    const num = quotedFees === '' ? null : Number(quotedFees);
    await updateField('feesReceived', num);
    toast.success('Fees received set to quoted amount');
  }

  async function handleMarkDone() {
    setUpdating(true);
    try {
      await updateClient(uid, fyId, client.id, { status: 'paid' });
      toast.success(`${client.name} marked as done`);
    } catch {
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
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  }

  const quotedDisplay = formatINR(client.quotedFees);
  const receivedDisplay = formatINR(client.feesReceived);

  return (
    <div
      className="border border-border rounded-lg bg-card overflow-hidden transition-shadow hover:shadow-sm status-transition row-enter"
      data-testid={`client-row-${client.id}`}
    >
      {/* ── Collapsed Header (always visible) ── */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-accent/5 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-muted-foreground shrink-0">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>

        {/* Name */}
        <span className="font-semibold text-sm flex-1 truncate">{client.name}</span>

        {/* Summary badges */}
        <div className="flex items-center gap-2 shrink-0">
          {quotedDisplay && (
            <span className="hidden sm:inline text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {quotedDisplay}
            </span>
          )}
          {receivedDisplay && (
            <span className="hidden sm:inline text-xs font-mono font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded">
              {receivedDisplay}
            </span>
          )}
        </div>

        {/* Action buttons (stop propagation so click doesn't toggle) */}
        <div
          className="flex items-center gap-1.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            size="sm"
            onClick={handleMarkDone}
            disabled={updating}
            className="h-7 px-2.5 text-xs bg-accent hover:bg-accent/90 text-accent-foreground"
            data-testid={`button-mark-paid-${client.id}`}
          >
            <Check className="w-3.5 h-3.5 mr-1" />
            Done
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={handleNoService}
            disabled={updating}
            title="No Service"
            className="h-7 w-7 shrink-0"
            data-testid={`button-no-service-${client.id}`}
          >
            <Ban className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Expanded Body ── */}
      {open && (
        <div className="border-t border-border px-4 py-4 bg-card space-y-4">
          {/* Quoted + Received side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Quoted Fees */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Quoted Fees</label>
              <Input
                type="number"
                value={quotedFees}
                onChange={(e) => handleQuotedChange(e.target.value)}
                placeholder="0"
                className="font-mono"
                data-testid={`input-quoted-${client.id}`}
              />
              {/* Recent fees pills */}
              {recentFees.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {recentFees.map((fee) => (
                    <button
                      key={fee}
                      onClick={() => handleQuotedPill(fee)}
                      className="text-xs px-2 py-0.5 rounded-full border border-border bg-muted hover:bg-accent/20 hover:border-accent/40 text-muted-foreground hover:text-foreground transition-colors font-mono"
                      title={`Set quoted fees to ${formatINR(fee)}`}
                    >
                      {formatINR(fee)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fees Received */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Fees Received</label>
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
                    onClick={() => setFeesReceivedEditing(false)}
                    className="shrink-0 h-9 w-9 text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950"
                    title="Done editing"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-1">
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
                  <div className="flex-1 h-9 px-3 flex items-center font-mono text-sm bg-muted/40 rounded-md border border-border min-w-0">
                    {feesReceived
                      ? <span>{formatINR(Number(feesReceived))}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </div>
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
          </div>

          {/* Comments */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Comments</label>
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
      )}
    </div>
  );
}
