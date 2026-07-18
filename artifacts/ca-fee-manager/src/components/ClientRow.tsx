import { useState, useEffect, useRef } from 'react';
import { Client, HistoryEntry, updateClient } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Check, UserX, Pencil, CheckCheck, ChevronDown, ChevronRight, CreditCard, Tag, FileCheck2 } from 'lucide-react';
import { toast } from 'sonner';
import { HistoryLog } from './HistoryLog';
import { CommentInput } from './CommentInput';

interface ClientRowProps {
  client: Client;
  uid: string;
  fyId: string;
}

function getRecentFees(): number[] {
  try {
    const stored = localStorage.getItem('recentQuotedFees');
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}
function addRecentFee(fee: number) {
  const recent = getRecentFees().filter((f) => f !== fee);
  recent.unshift(fee);
  localStorage.setItem('recentQuotedFees', JSON.stringify(recent.slice(0, 4)));
}
function formatINR(amount: number | null | undefined) {
  if (amount === null || amount === undefined) return null;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}
function makeEntry(action: string): HistoryEntry {
  return { id: crypto.randomUUID(), at: new Date().toISOString(), action };
}

export function ClientRow({ client, uid, fyId }: ClientRowProps) {
  const [open, setOpen] = useState(false);
  const [quotedFees, setQuotedFees] = useState(client.quotedFees?.toString() || '');
  const [otherDues, setOtherDues] = useState(client.otherDues?.toString() || '');
  const [feesReceived, setFeesReceived] = useState(client.feesReceived?.toString() || '');
  const [updating, setUpdating] = useState(false);
  const [feesReceivedEditing, setFeesReceivedEditing] = useState(false);
  const [recentFees, setRecentFees] = useState<number[]>([]);
  const [exiting, setExiting] = useState(false);
  const [showDoneDialog, setShowDoneDialog] = useState(false);
  const [showNoServiceDialog, setShowNoServiceDialog] = useState(false);

  // Partial / discount dialog
  interface PartialDialogData { received: number; quoted: number; diff: number; afterDone: boolean; }
  const [partialData, setPartialData] = useState<PartialDialogData | null>(null);

  const quotedTimeoutRef = useRef<NodeJS.Timeout>();
  const otherDuesTimeoutRef = useRef<NodeJS.Timeout>();
  const receivedTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setQuotedFees(client.quotedFees?.toString() || '');
    setOtherDues(client.otherDues?.toString() || '');
    setFeesReceived(client.feesReceived?.toString() || '');
  }, [client.quotedFees, client.otherDues, client.feesReceived]);

  useEffect(() => { if (open) setRecentFees(getRecentFees()); }, [open]);

  async function handleItrFiled() {
    const newValue = !client.itrFiled;
    const entry = makeEntry(newValue ? 'ITR Filed' : 'ITR Status Removed');
    await updateClient(uid, fyId, client.id, {
      itrFiled: newValue,
      history: [...(client.history || []), entry],
    });
    toast.success(newValue ? `ITR filed for ${client.name}` : `ITR status removed for ${client.name}`);
  }

  async function updateField(field: string, value: any) {
    try { await updateClient(uid, fyId, client.id, { [field]: value }); }
    catch { toast.error('Failed to update'); }
  }

  function handleQuotedChange(value: string) {
    setQuotedFees(value);
    clearTimeout(quotedTimeoutRef.current);
    quotedTimeoutRef.current = setTimeout(() => {
      const num = value === '' ? null : Number(value);
      if (value !== '' && isNaN(num as number)) return;
      if (num !== null) { addRecentFee(num); setRecentFees(getRecentFees()); }
      updateField('quotedFees', num);
    }, 600);
  }
  function handleOtherDuesChange(value: string) {
    setOtherDues(value);
    clearTimeout(otherDuesTimeoutRef.current);
    otherDuesTimeoutRef.current = setTimeout(() => {
      const num = value === '' ? null : Number(value);
      if (value !== '' && isNaN(num as number)) return;
      updateField('otherDues', num);
    }, 600);
  }
  function handleQuotedPill(fee: number) {
    setQuotedFees(fee.toString());
    addRecentFee(fee); setRecentFees(getRecentFees());
    updateField('quotedFees', fee);
  }
  function handleReceivedChange(value: string) {
    setFeesReceived(value);
    clearTimeout(receivedTimeoutRef.current);
    receivedTimeoutRef.current = setTimeout(() => {
      const num = value === '' ? null : Number(value);
      if (value !== '' && isNaN(num as number)) return;
      updateField('feesReceived', num);
    }, 600);
  }
  async function handleAddComment(text: string) {
    const entry = makeEntry(`Note: ${text}`);
    await updateClient(uid, fyId, client.id, {
      history: [...(client.history || []), entry],
    });
  }

  // Checkmark quick-set: received = total fees
  async function handleCheckFees() {
    clearTimeout(receivedTimeoutRef.current);
    const totalNum = (client.quotedFees ?? 0) + (client.otherDues ?? 0);
    const totalStr = totalNum.toString();
    setFeesReceived(totalStr);
    setFeesReceivedEditing(false);
    await updateField('feesReceived', totalNum || null);
    toast.success('Fees received set to total fees');
  }

  async function handleDoneEditingFees() {
    clearTimeout(receivedTimeoutRef.current);
    const num = feesReceived === '' ? null : Number(feesReceived);
    if (feesReceived !== '' && isNaN(num as number)) { setFeesReceivedEditing(false); return; }
    await updateField('feesReceived', num);
    setFeesReceivedEditing(false);

    const totalFees = (client.quotedFees ?? 0) + (client.otherDues ?? 0);
    const effectiveQuoted = totalFees || (quotedFees ? Number(quotedFees) : null);
    if (num !== null && effectiveQuoted !== null && num < effectiveQuoted && !client.paymentType) {
      setPartialData({ received: num, quoted: effectiveQuoted, diff: effectiveQuoted - num, afterDone: false });
    }
  }

  function handleDoneClick() {
    const received = client.feesReceived;
    const totalFees = (client.quotedFees ?? 0) + (client.otherDues ?? 0);
    if (received !== null && totalFees > 0 && received < totalFees && !client.paymentType) {
      setPartialData({ received, quoted: totalFees, diff: totalFees - received, afterDone: true });
      return;
    }
    setShowDoneDialog(true);
  }

  function handleDoneConfirm() {
    setShowDoneDialog(false);
    setExiting(true);
    setTimeout(async () => {
      try {
        const entry = makeEntry('Marked as Paid');
        await updateClient(uid, fyId, client.id, {
          status: 'paid',
          history: [...(client.history || []), entry],
        });
        toast.success(`${client.name} marked as done`);
      } catch {
        toast.error('Failed to update status');
        setExiting(false);
      }
    }, 320);
  }

  async function handleNoServiceConfirm() {
    setShowNoServiceDialog(false);
    setUpdating(true);
    try {
      const entry = makeEntry('Marked as No Service');
      await updateClient(uid, fyId, client.id, {
        status: 'no_service',
        history: [...(client.history || []), entry],
      });
      toast.success(`${client.name} marked as no service`);
    } catch { toast.error('Failed to update status'); }
    finally { setUpdating(false); }
  }

  async function handlePartialChoice(choice: 'partial' | 'discount') {
    if (!partialData) return;
    const { received, quoted, diff, afterDone } = partialData;
    setPartialData(null);

    const history = [...(client.history || [])];

    if (choice === 'partial') {
      const entry = makeEntry(
        `Partial payment of ${formatINR(received)} received. ${formatINR(diff)} still pending.`
      );
      history.push(entry);
      setExiting(true);
      setTimeout(async () => {
        try {
          await updateClient(uid, fyId, client.id, { status: 'partial', paymentType: 'partial', history });
          toast.success(`${client.name} moved to Partial Payments`);
        } catch {
          toast.error('Failed to update status');
          setExiting(false);
        }
      }, 320);
    } else {
      const entry = makeEntry(
        `Discount of ${formatINR(diff)} applied. Effective fees: ${formatINR(received)}.`
      );
      history.push(entry);
      if (afterDone) {
        const doneEntry = makeEntry('Marked as Paid');
        history.push(doneEntry);
        setExiting(true);
        setTimeout(async () => {
          try {
            await updateClient(uid, fyId, client.id, { status: 'paid', paymentType: 'discount', history });
            toast.success(`${client.name} marked as done`);
          } catch {
            toast.error('Failed to update status');
            setExiting(false);
          }
        }, 320);
      } else {
        await updateClient(uid, fyId, client.id, { paymentType: 'discount', history });
        toast.success('Discount recorded');
      }
    }
  }

  const quotedNum = client.quotedFees ?? 0;
  const otherDuesNum = client.otherDues ?? 0;
  const totalFees = quotedNum + otherDuesNum;
  const hasOtherDues = (client.otherDues ?? 0) > 0;

  const headerFeeDisplay = hasOtherDues
    ? formatINR(totalFees)
    : formatINR(client.quotedFees);
  const receivedDisplay = formatINR(client.feesReceived);

  return (
    <>
      {/* ── Done confirmation ── */}
      <AlertDialog open={showDoneDialog} onOpenChange={setShowDoneDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Done?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">{client.name}</span> will be moved to{' '}
              <span className="font-medium">Fees Paid</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDoneConfirm}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <Check className="w-4 h-4 mr-1.5" />Confirm Done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── No Service confirmation ── */}
      <AlertDialog open={showNoServiceDialog} onOpenChange={setShowNoServiceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No Service This Year?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">{client.name}</span> will be moved to{' '}
              <span className="font-medium">No Service</span>. You can undo this anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleNoServiceConfirm} variant="destructive">
              <UserX className="w-4 h-4 mr-1.5" />Confirm No Service
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Partial / Discount dialog ── */}
      <Dialog open={!!partialData} onOpenChange={(o) => { if (!o) setPartialData(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fees Less Than Quoted</DialogTitle>
            <DialogDescription>
              {partialData && (
                <>
                  <span className="font-medium text-foreground">{formatINR(partialData.received)}</span> received vs{' '}
                  <span className="font-medium text-foreground">{formatINR(partialData.quoted)}</span> total —{' '}
                  <span className="font-semibold text-destructive">{formatINR(partialData.diff)}</span> difference.
                  How should this be recorded?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <button
              onClick={() => handlePartialChoice('partial')}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-orange-200 bg-orange-50 hover:bg-orange-100 hover:border-orange-400 dark:border-orange-800 dark:bg-orange-950/30 dark:hover:bg-orange-950/60 transition-colors text-left"
            >
              <CreditCard className="w-6 h-6 text-orange-500" />
              <div>
                <p className="font-semibold text-sm">Partial Payment</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {partialData && formatINR(partialData.diff)} still pending
                </p>
              </div>
            </button>
            <button
              onClick={() => handlePartialChoice('discount')}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 dark:border-blue-800 dark:bg-blue-950/30 dark:hover:bg-blue-950/60 transition-colors text-left"
            >
              <Tag className="w-6 h-6 text-blue-500" />
              <div>
                <p className="font-semibold text-sm">Discount</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {partialData && formatINR(partialData.diff)} discount given
                </p>
              </div>
            </button>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPartialData(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Card ── */}
      <div
        className={`border border-border rounded-lg bg-card overflow-hidden hover:shadow-sm row-enter ${exiting ? 'row-exit' : 'status-transition'}`}
        data-testid={`client-row-${client.id}`}
      >
        {/* Collapsed Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-accent/5 transition-colors"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="text-muted-foreground shrink-0">
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
          <span className="font-semibold text-sm flex-1 truncate">{client.name}</span>
          <div className="flex items-center gap-2 shrink-0">
            {client.itrFiled && (
              <span className="hidden sm:inline text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded">
                ITR ✓
              </span>
            )}
            {headerFeeDisplay && (
              <span className="hidden sm:inline text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded" title={hasOtherDues ? `Total (Quoted + Other Dues)` : 'Quoted Fees'}>
                {hasOtherDues && <span className="mr-0.5 opacity-60">∑</span>}{headerFeeDisplay}
              </span>
            )}
            {receivedDisplay && (
              <span className="hidden sm:inline text-xs font-mono font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded">
                {receivedDisplay}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              onClick={handleDoneClick}
              disabled={updating || exiting}
              className="h-7 px-2.5 text-xs bg-accent hover:bg-accent/90 text-accent-foreground"
              data-testid={`button-mark-paid-${client.id}`}
            >
              <Check className="w-3.5 h-3.5 mr-1" />Done
            </Button>
            <Button
              size="icon"
              variant={client.itrFiled ? 'default' : 'outline'}
              onClick={handleItrFiled}
              disabled={updating || exiting}
              title={client.itrFiled ? 'ITR Filed — click to unmark' : 'Mark ITR Filed'}
              className={
                client.itrFiled
                  ? 'h-7 w-7 shrink-0 bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
                  : 'h-7 w-7 shrink-0 text-blue-600 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950'
              }
              data-testid={`button-itr-filed-${client.id}`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon" variant="outline"
              onClick={() => setShowNoServiceDialog(true)}
              disabled={updating || exiting}
              title="No Service"
              className="h-7 w-7 shrink-0"
              data-testid={`button-no-service-${client.id}`}
            >
              <UserX className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Expanded Body */}
        {open && (
          <div className="border-t border-border px-4 py-4 bg-card space-y-4">
            {/* Quoted Fees + Other Dues */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Quoted Fees</label>
                <Input
                  type="number" value={quotedFees}
                  onChange={(e) => handleQuotedChange(e.target.value)}
                  placeholder="0" className="font-mono"
                  data-testid={`input-quoted-${client.id}`}
                />
                {recentFees.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {recentFees.map((fee) => (
                      <button
                        key={fee} onClick={() => handleQuotedPill(fee)}
                        className="text-xs px-2 py-0.5 rounded-full border border-border bg-muted hover:bg-accent/20 hover:border-accent/40 text-muted-foreground hover:text-foreground transition-colors font-mono"
                        title={`Set to ${formatINR(fee)}`}
                      >
                        {formatINR(fee)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Other Dues</label>
                <Input
                  type="number" value={otherDues}
                  onChange={(e) => handleOtherDuesChange(e.target.value)}
                  placeholder="0" className="font-mono"
                  data-testid={`input-other-dues-${client.id}`}
                />
                {hasOtherDues && (
                  <p className="text-xs text-muted-foreground font-mono">
                    Total: <span className="font-semibold text-foreground">{formatINR(totalFees)}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Fees Received */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Fees Received</label>
              {feesReceivedEditing ? (
                <div className="flex gap-1">
                  <Input
                    type="number" value={feesReceived}
                    onChange={(e) => handleReceivedChange(e.target.value)}
                    placeholder="0" className="font-mono" autoFocus
                    data-testid={`input-received-${client.id}`}
                  />
                  <Button
                    size="icon" variant="outline"
                    onClick={handleDoneEditingFees}
                    className="shrink-0 h-9 w-9 text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950"
                    title="Done editing"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <Button
                    size="icon" variant="outline"
                    onClick={handleCheckFees} disabled={!quotedFees && !otherDues}
                    className="shrink-0 h-9 w-9 text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950"
                    title="Set fees received = total fees"
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
                    size="icon" variant="ghost"
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

            {/* Comment input + History */}
            <div className="border-t border-border pt-3 space-y-4">
              <CommentInput onSubmit={handleAddComment} />
              <HistoryLog history={client.history} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
