import { useState, useEffect, useRef } from 'react';
import { Client, HistoryEntry, updateClient } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Check, UserX, Pencil, CheckCheck, ChevronDown, ChevronRight, CreditCard, Tag, FileCheck2 } from 'lucide-react';


function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>
  );
}
import { toast } from 'sonner';
import { HistoryLog } from './HistoryLog';
import { CommentInput } from './CommentInput';
import { TagSelector, TagChip } from './TagSelector';
import { AddMobileDialog } from './AddMobileDialog';

interface ClientRowProps {
  client: Client;
  uid: string;
  fyId: string;
  fyName: string;
  allTags: string[];
  waTemplate: string; // active WA message template (empty = use built-in default)
  upiId: string;      // payee UPI VPA; empty = no QR
}

const FIXED_FEE_PILLS = [1000, 1500, 2000, 2500, 3000, 4000];

function formatINR(amount: number | null | undefined) {
  if (amount === null || amount === undefined) return null;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}
function makeEntry(action: string): HistoryEntry {
  return { id: crypto.randomUUID(), at: new Date().toISOString(), action };
}

function cleanMobile(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return '91' + digits;
  return digits;
}

export function ClientRow({ client, uid, fyId, fyName, allTags, waTemplate, upiId }: ClientRowProps) {
  const [open, setOpen] = useState(false);
  const [quotedFees, setQuotedFees] = useState(client.quotedFees?.toString() || '');
  const [otherDues, setOtherDues] = useState(client.otherDues?.toString() || '');
  const [feesReceived, setFeesReceived] = useState(client.feesReceived?.toString() || '');
  const [updating, setUpdating] = useState(false);
  const [feesReceivedEditing, setFeesReceivedEditing] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [showDoneDialog, setShowDoneDialog] = useState(false);
  const [showNoServiceDialog, setShowNoServiceDialog] = useState(false);
  const [showAddMobile, setShowAddMobile] = useState(false);

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

  async function handleItrFiled() {
    const newValue = !client.itrFiled;
    const entry = makeEntry(newValue ? 'ITR Filed' : 'ITR Status Removed');
    await updateClient(uid, fyId, client.id, { itrFiled: newValue, history: [...(client.history || []), entry] });
    toast.success(newValue ? `ITR filed for ${client.name}` : `ITR status removed for ${client.name}`);
  }

  async function handleTagsChange(tags: string[]) {
    await updateClient(uid, fyId, client.id, { tags });
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
    await updateClient(uid, fyId, client.id, { history: [...(client.history || []), entry] });
  }

  async function handleCheckFees() {
    clearTimeout(receivedTimeoutRef.current);
    const totalNum = (client.quotedFees ?? 0) + (client.otherDues ?? 0);
    setFeesReceived(totalNum.toString());
    setFeesReceivedEditing(false);
    const entry = makeEntry(`Fees received set to total (${formatINR(totalNum)})`);
    await updateClient(uid, fyId, client.id, {
      feesReceived: totalNum || null,
      history: [...(client.history || []), entry],
    });
    toast.success('Fees received set to total fees');
  }

  async function handleDoneEditingFees() {
    clearTimeout(receivedTimeoutRef.current);
    const num = feesReceived === '' ? null : Number(feesReceived);
    if (feesReceived !== '' && isNaN(num as number)) { setFeesReceivedEditing(false); return; }

    const totalFees = (client.quotedFees ?? 0) + (client.otherDues ?? 0);
    const effectiveQuoted = totalFees > 0 ? totalFees : (quotedFees ? Number(quotedFees) : null);
    const willShowPopup = num !== null && effectiveQuoted !== null && num < effectiveQuoted;

    if (!willShowPopup) {
      // Save with a history note
      const entry = makeEntry(`Fees received updated to ${num !== null ? formatINR(num) : '—'}`);
      await updateClient(uid, fyId, client.id, {
        feesReceived: num,
        history: [...(client.history || []), entry],
      });
    } else {
      // Just save the value — the popup choice will add the history note
      await updateField('feesReceived', num);
    }

    setFeesReceivedEditing(false);
    if (willShowPopup) {
      setPartialData({ received: num!, quoted: effectiveQuoted!, diff: effectiveQuoted! - num!, afterDone: false });
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
        await updateClient(uid, fyId, client.id, { status: 'paid', history: [...(client.history || []), entry] });
        toast.success(`${client.name} marked as done`);
      } catch { toast.error('Failed to update status'); setExiting(false); }
    }, 320);
  }

  async function sendWhatsApp(mobile: string) {
    const totalFees = (client.quotedFees ?? 0) + (client.otherDues ?? 0);
    const received = client.feesReceived ?? 0;
    const pending = totalFees > 0 ? totalFees - received : null;
    const amountStr = pending !== null && pending > 0 ? (formatINR(pending) ?? 'pending amount') : 'pending amount';

    const DEFAULT_TEMPLATE = `Dear {name}, this is a gentle reminder regarding your pending ITR filing fees of {amount} for FY {fy}. Kindly arrange payment at your earliest convenience. Thank you.`;
    const template = waTemplate || DEFAULT_TEMPLATE;
    let message = template
      .replace(/\{name\}/g, client.name)
      .replace(/\{amount\}/g, amountStr)
      .replace(/\{fy\}/g, fyName || 'current year');

    if (upiId && pending !== null && pending > 0) {
      message += `\n\nPay ${amountStr} via UPI:\nUPI ID: ${upiId}`;
    }

    window.open(`https://wa.me/${cleanMobile(mobile)}?text=${encodeURIComponent(message)}`, '_blank');
    const entry = makeEntry(`WhatsApp reminder sent — ${amountStr} pending`);
    await updateClient(uid, fyId, client.id, { history: [...(client.history || []), entry] });
  }

  async function handleWhatsApp() {
    if (!client.mobile) { setShowAddMobile(true); return; }
    await sendWhatsApp(client.mobile);
  }

  async function handleSaveMobileAndSend(mobile: string) {
    await updateClient(uid, fyId, client.id, { mobile });
    setShowAddMobile(false);
    await sendWhatsApp(mobile);
  }

  async function handleNoServiceConfirm() {
    setShowNoServiceDialog(false);
    setUpdating(true);
    try {
      const entry = makeEntry('Marked as No Service');
      await updateClient(uid, fyId, client.id, { status: 'no_service', history: [...(client.history || []), entry] });
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
      history.push(makeEntry(`Partial payment of ${formatINR(received)} received. ${formatINR(diff)} still pending.`));
      setExiting(true);
      setTimeout(async () => {
        try {
          await updateClient(uid, fyId, client.id, { status: 'partial', paymentType: 'partial', history });
          toast.success(`${client.name} moved to Partial Payments`);
        } catch { toast.error('Failed to update status'); setExiting(false); }
      }, 320);
    } else {
      history.push(makeEntry(`Discount of ${formatINR(diff)} applied. Effective fees: ${formatINR(received)}.`));
      if (afterDone) {
        history.push(makeEntry('Marked as Paid'));
        setExiting(true);
        setTimeout(async () => {
          try {
            await updateClient(uid, fyId, client.id, { status: 'paid', paymentType: 'discount', history });
            toast.success(`${client.name} marked as done`);
          } catch { toast.error('Failed to update status'); setExiting(false); }
        }, 320);
      } else {
        await updateClient(uid, fyId, client.id, { paymentType: 'discount', history });
        toast.success('Discount recorded');
      }
    }
  }

  const hasOtherDues = (client.otherDues ?? 0) > 0;
  const totalFees = (client.quotedFees ?? 0) + (client.otherDues ?? 0);
  const headerFeeDisplay = hasOtherDues ? formatINR(totalFees) : formatINR(client.quotedFees);
  const receivedDisplay = formatINR(client.feesReceived);
  const clientTags = client.tags || [];

  return (
    <>
      <AddMobileDialog
        open={showAddMobile}
        onOpenChange={setShowAddMobile}
        clientName={client.name}
        onConfirm={handleSaveMobileAndSend}
      />

      <AlertDialog open={showDoneDialog} onOpenChange={setShowDoneDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Done?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">{client.name}</span> will be moved to <span className="font-medium">Fees Paid</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDoneConfirm} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Check className="w-4 h-4 mr-1.5" />Confirm Done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showNoServiceDialog} onOpenChange={setShowNoServiceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No Service This Year?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">{client.name}</span> will be moved to <span className="font-medium">No Service</span>. You can undo this anytime.
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

      <Dialog open={!!partialData} onOpenChange={(o) => { if (!o) setPartialData(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fees Less Than Quoted</DialogTitle>
            <DialogDescription>
              {partialData && (
                <><span className="font-medium text-foreground">{formatINR(partialData.received)}</span> received vs{' '}
                <span className="font-medium text-foreground">{formatINR(partialData.quoted)}</span> total —{' '}
                <span className="font-semibold text-destructive">{formatINR(partialData.diff)}</span> difference. How should this be recorded?</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <button onClick={() => handlePartialChoice('partial')} className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-orange-200 bg-orange-50 hover:bg-orange-100 hover:border-orange-400 dark:border-orange-800 dark:bg-orange-950/30 dark:hover:bg-orange-950/60 transition-colors text-left">
              <CreditCard className="w-6 h-6 text-orange-500" />
              <div><p className="font-semibold text-sm">Partial Payment</p><p className="text-xs text-muted-foreground mt-0.5">{partialData && formatINR(partialData.diff)} still pending</p></div>
            </button>
            <button onClick={() => handlePartialChoice('discount')} className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 dark:border-blue-800 dark:bg-blue-950/30 dark:hover:bg-blue-950/60 transition-colors text-left">
              <Tag className="w-6 h-6 text-blue-500" />
              <div><p className="font-semibold text-sm">Discount</p><p className="text-xs text-muted-foreground mt-0.5">{partialData && formatINR(partialData.diff)} discount given</p></div>
            </button>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPartialData(null)}>Cancel</Button>
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
          className="flex items-start gap-3 px-4 py-3 cursor-pointer select-none hover:bg-accent/5 transition-colors"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="text-muted-foreground shrink-0 mt-0.5">
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-sm block truncate">{client.name}</span>
            {clientTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {clientTags.map((tag) => <TagChip key={tag} tag={tag} active small />)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-0.5">
            {client.itrFiled && (
              <span className="hidden sm:inline text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded">
                ITR ✓
              </span>
            )}
            {headerFeeDisplay && (
              <span className="hidden sm:inline text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded" title={hasOtherDues ? 'Total (Quoted + Other Dues)' : 'Quoted Fees'}>
                {hasOtherDues && <span className="mr-0.5 opacity-60">∑</span>}{headerFeeDisplay}
              </span>
            )}
            {receivedDisplay && (
              <span className="hidden sm:inline text-xs font-mono font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded">
                {receivedDisplay}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" onClick={handleDoneClick} disabled={updating || exiting}
              className="h-7 w-7 px-0 sm:w-auto sm:px-2.5 text-xs bg-accent hover:bg-accent/90 text-accent-foreground"
              data-testid={`button-mark-paid-${client.id}`}>
              <Check className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Done</span>
            </Button>
            <Button size="icon"
              variant={client.itrFiled ? 'default' : 'outline'}
              onClick={handleItrFiled} disabled={updating || exiting}
              title={client.itrFiled ? 'ITR Filed — click to unmark' : 'Mark ITR Filed'}
              className={client.itrFiled ? 'h-7 w-7 shrink-0 bg-blue-600 hover:bg-blue-700 text-white border-blue-600' : 'h-7 w-7 shrink-0 text-blue-600 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950'}
              data-testid={`button-itr-filed-${client.id}`}>
              <FileCheck2 className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="outline" onClick={handleWhatsApp} disabled={updating || exiting}
              title={client.mobile ? `WhatsApp ${client.name}` : 'No mobile number saved'}
              className="h-7 w-7 shrink-0 text-[#25D366] border-[#25D366]/40 hover:bg-[#25D366]/10 dark:hover:bg-[#25D366]/20"
              data-testid={`button-whatsapp-${client.id}`}>
              <WhatsAppIcon className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Expanded Body */}
        {open && (
          <div className="border-t border-border px-4 py-4 bg-card space-y-4">
            {/* Quoted + Other Dues */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Quoted Fees</label>
                <Input type="number" value={quotedFees} onChange={(e) => handleQuotedChange(e.target.value)}
                  placeholder="0" className="font-mono" data-testid={`input-quoted-${client.id}`} />
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {FIXED_FEE_PILLS.map((fee) => (
                    <button key={fee} onClick={() => handleQuotedPill(fee)}
                      className="text-xs px-2 py-0.5 rounded-full border border-border bg-muted hover:bg-accent/20 hover:border-accent/40 text-muted-foreground hover:text-foreground transition-colors font-mono"
                      title={`Set to ${formatINR(fee)}`}>
                      {formatINR(fee)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Other Dues</label>
                <Input type="number" value={otherDues} onChange={(e) => handleOtherDuesChange(e.target.value)}
                  placeholder="0" className="font-mono" data-testid={`input-other-dues-${client.id}`} />
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
                  <Input type="number" value={feesReceived} onChange={(e) => handleReceivedChange(e.target.value)}
                    placeholder="0" className="font-mono" autoFocus data-testid={`input-received-${client.id}`} />
                  <Button size="icon" variant="outline" onClick={handleDoneEditingFees}
                    className="shrink-0 h-9 w-9 text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950" title="Done editing">
                    <CheckCheck className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <Button size="icon" variant="outline" onClick={handleCheckFees} disabled={!quotedFees && !otherDues}
                    className="shrink-0 h-9 w-9 text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950"
                    title="Set fees received = total fees" data-testid={`button-check-fees-${client.id}`}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <div className="flex-1 h-9 px-3 flex items-center font-mono text-sm bg-muted/40 rounded-md border border-border min-w-0">
                    {feesReceived ? <span>{formatINR(Number(feesReceived))}</span> : <span className="text-muted-foreground">—</span>}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setFeesReceivedEditing(true)}
                    className="shrink-0 h-9 w-9 text-muted-foreground hover:text-foreground" title="Edit fees received"
                    data-testid={`button-edit-received-${client.id}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Tags */}
            <TagSelector selectedTags={clientTags} allTags={allTags} onChange={handleTagsChange} />

            {/* No Service */}
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowNoServiceDialog(true)} disabled={updating || exiting}
                className="h-8 px-3 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/50 hover:bg-destructive/5"
                data-testid={`button-no-service-${client.id}`}>
                <UserX className="w-3.5 h-3.5 mr-1.5" />No Service This Year
              </Button>
            </div>

            {/* Comment + History */}
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
