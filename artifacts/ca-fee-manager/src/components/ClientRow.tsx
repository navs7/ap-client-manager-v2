import { useState, useEffect, useRef, useMemo } from 'react';
import { Client, HistoryEntry, OtherDuesItem, updateClient } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Check, UserX, ChevronDown, ChevronRight, CreditCard, Tag,
  FileCheck2, Plus, X, Loader2, Save,
} from 'lucide-react';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

import { toast } from 'sonner';
import { HistoryLog } from './HistoryLog';
import { CommentInput } from './CommentInput';
import { TagSelector, TagChip } from './TagSelector';
import { AddMobileDialog } from './AddMobileDialog';
import { dirtyRegistry } from '@/lib/dirtyRegistry';

interface ClientRowProps {
  client: Client;
  uid: string;
  fyId: string;
  fyName: string;
  allTags: string[];
  waTemplate: string;
  upiId: string;
}

const FIXED_FEE_PILLS = [1000, 1500, 2000, 2500, 3000, 4000];

interface DuesItemLocal { id: string; amount: string; type: string; }

interface Draft {
  quotedFees: string;
  duesItems: DuesItemLocal[];
  feesReceived: string;
  itrFiled: boolean;
  tags: string[];
}

function makeDraft(c: Client): Draft {
  return {
    quotedFees: c.quotedFees?.toString() ?? '',
    duesItems: c.otherDuesItems?.length
      ? c.otherDuesItems.map(i => ({ id: i.id, amount: i.amount.toString(), type: i.type }))
      : c.otherDues != null
        ? [{ id: crypto.randomUUID(), amount: c.otherDues.toString(), type: 'Other Dues' }]
        : [],
    feesReceived: c.feesReceived?.toString() ?? '',
    itrFiled: c.itrFiled,
    tags: c.tags || [],
  };
}

function serializeClientDues(c: Client): string {
  if (c.otherDuesItems?.length)
    return c.otherDuesItems.map(i => `${i.amount}:${i.type}`).join('|');
  if (c.otherDues != null) return `${c.otherDues}:Other Dues`;
  return '';
}

function serializeDraftDues(items: DuesItemLocal[]): string {
  return items
    .filter(i => parseFloat(i.amount) > 0)
    .map(i => `${parseFloat(i.amount)}:${i.type.trim() || 'Other Dues'}`)
    .join('|');
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

function cleanMobile(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return '91' + digits;
  return digits;
}

export function ClientRow({ client, uid, fyId, fyName, allTags, waTemplate, upiId }: ClientRowProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => makeDraft(client));
  const [saving, setSaving] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [showDoneDialog, setShowDoneDialog] = useState(false);
  const [showNoServiceDialog, setShowNoServiceDialog] = useState(false);
  const [showAddMobile, setShowAddMobile] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  interface PartialDialogData { received: number; quoted: number; diff: number; afterDone: boolean; }
  const [partialData, setPartialData] = useState<PartialDialogData | null>(null);

  // ── Dirty detection ────────────────────────────────────────────────────────
  const isDirty = useMemo(() => {
    if (draft.quotedFees !== (client.quotedFees?.toString() ?? '')) return true;
    if (draft.feesReceived !== (client.feesReceived?.toString() ?? '')) return true;
    if (draft.itrFiled !== client.itrFiled) return true;
    if ([...draft.tags].sort().join(',') !== [...(client.tags || [])].sort().join(',')) return true;
    if (serializeDraftDues(draft.duesItems) !== serializeClientDues(client)) return true;
    return false;
  }, [draft, client]);

  const isDirtyRef = useRef(false);
  isDirtyRef.current = isDirty;

  // Register with global dirty registry (for navigation guard)
  useEffect(() => {
    dirtyRegistry.register(client.id, isDirty);
    return () => dirtyRegistry.register(client.id, false);
  }, [client.id, isDirty]);

  // Warn on browser close / refresh when dirty
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Sync draft from Firestore when the card has no unsaved changes
  useEffect(() => {
    if (!isDirtyRef.current) setDraft(makeDraft(client));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.updatedAt]);

  // ── Toggle & save/cancel ───────────────────────────────────────────────────
  function handleToggleOpen() {
    if (open && isDirty) {
      setShowUnsavedDialog(true);
    } else {
      setOpen(o => !o);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const quotedNum  = draft.quotedFees  === '' ? null : Number(draft.quotedFees);
      const receivedNum = draft.feesReceived === '' ? null : Number(draft.feesReceived);
      const converted: OtherDuesItem[] = draft.duesItems.map(i => ({
        id: i.id,
        amount: parseFloat(i.amount) || 0,
        type: i.type.trim() || 'Other Dues',
      }));
      const duesSum  = converted.reduce((s, i) => s + i.amount, 0);
      const totalFees = (quotedNum ?? 0) + duesSum;

      // Build history note listing what changed
      const notes: string[] = [];
      if (draft.quotedFees !== (client.quotedFees?.toString() ?? ''))
        notes.push(`Quoted Fees: ${formatINR(quotedNum)}`);

      if (serializeDraftDues(draft.duesItems) !== serializeClientDues(client)) {
        const nz = converted.filter(i => i.amount > 0);
        if (nz.length === 0)
          notes.push('Other Dues cleared');
        else if (nz.length === 1)
          notes.push(`Other Dues: ${nz[0].type} ${formatINR(nz[0].amount)}`);
        else
          notes.push(`Other Dues: ${formatINR(duesSum)} total (${nz.map(i => `${i.type} ${formatINR(i.amount)}`).join(', ')})`);
      }

      if (draft.feesReceived !== (client.feesReceived?.toString() ?? ''))
        notes.push(`Fees Received: ${receivedNum !== null ? formatINR(receivedNum) : '—'}`);

      if (draft.itrFiled !== client.itrFiled)
        notes.push(draft.itrFiled ? 'ITR Filed' : 'ITR Status Removed');

      if ([...draft.tags].sort().join(',') !== [...(client.tags || [])].sort().join(','))
        notes.push(`Tags: ${draft.tags.join(', ') || 'none'}`);

      const history = [...(client.history || [])];
      if (notes.length > 0) history.push(makeEntry(`Saved — ${notes.join('; ')}`));

      await updateClient(uid, fyId, client.id, {
        quotedFees: quotedNum,
        otherDues: duesSum || null,
        otherDuesItems: converted,
        feesReceived: receivedNum,
        itrFiled: draft.itrFiled,
        tags: draft.tags,
        history,
      });

      dirtyRegistry.register(client.id, false);
      toast.success('Changes saved');

      // Show partial-payment dialog if received < total
      if (receivedNum !== null && totalFees > 0 && receivedNum < totalFees && !client.paymentType) {
        setPartialData({ received: receivedNum, quoted: totalFees, diff: totalFees - receivedNum, afterDone: false });
      }
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(makeDraft(client));
  }

  async function handleSaveAndClose() {
    setShowUnsavedDialog(false);
    await handleSave();
    setOpen(false);
  }

  function handleDiscardAndClose() {
    setShowUnsavedDialog(false);
    setDraft(makeDraft(client));
    dirtyRegistry.register(client.id, false);
    setOpen(false);
  }

  // ── Fees helpers ───────────────────────────────────────────────────────────
  function handleCheckFees() {
    const q = parseFloat(draft.quotedFees) || 0;
    const d = draft.duesItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const total = q + d;
    setDraft(prev => ({ ...prev, feesReceived: total > 0 ? total.toString() : '' }));
  }

  // ── Comments (immediate — own submit flow) ─────────────────────────────────
  async function handleAddComment(text: string) {
    const entry = makeEntry(`Note: ${text}`);
    await updateClient(uid, fyId, client.id, { history: [...(client.history || []), entry] });
  }

  // ── Status actions ─────────────────────────────────────────────────────────
  function handleDoneClick() {
    if (isDirty) {
      toast.warning('Please save your changes before marking as done.');
      return;
    }
    const received  = client.feesReceived;
    const total = (client.quotedFees ?? 0) + (client.otherDues ?? 0);
    if (received !== null && total > 0 && received < total && !client.paymentType) {
      setPartialData({ received, quoted: total, diff: total - received, afterDone: true });
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

  async function handleNoServiceConfirm() {
    setShowNoServiceDialog(false);
    setSaving(true);
    try {
      const entry = makeEntry('Marked as No Service');
      await updateClient(uid, fyId, client.id, { status: 'no_service', history: [...(client.history || []), entry] });
      toast.success(`${client.name} marked as no service`);
    } catch { toast.error('Failed to update status'); }
    finally { setSaving(false); }
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

  // ── WhatsApp ───────────────────────────────────────────────────────────────
  async function sendWhatsApp(mobile: string) {
    const totalFees = (client.quotedFees ?? 0) + (client.otherDues ?? 0);
    const received  = client.feesReceived ?? 0;
    const pending   = totalFees > 0 ? totalFees - received : null;
    const amountStr = pending !== null && pending > 0
      ? (formatINR(pending) ?? 'pending amount')
      : 'pending amount';

    // {category} — first matching tag wins
    const tags = client.tags || [];
    const category = tags.includes('Business Owner') ? 'Business'
      : tags.includes('Capital Gain') ? 'Capital Gain'
      : tags.includes('Salaried') ? 'Salaried'
      : '';

    // {breakdown} block — only when other dues items exist
    const otherItems = client.otherDuesItems ?? [];
    let breakdownBlock = '';
    if (otherItems.length > 0 && totalFees > 0) {
      const lines: string[] = ['The breakup of above mentioned amount is:'];
      if (client.quotedFees) lines.push(`Fees for ITR filing - ${formatINR(client.quotedFees)}`);
      for (const item of otherItems) lines.push(`${item.type || 'Other Dues'} - ${formatINR(item.amount)}`);
      lines.push(`Total - ${formatINR(totalFees)}`);
      breakdownBlock = lines.join('\n');
    }

    const DEFAULT_TEMPLATE = `Dear {name}, this is a gentle reminder regarding your pending ITR filing fees of {amount} for FY {fy}. Kindly arrange payment at your earliest convenience. Thank you.`;
    const template = waTemplate || DEFAULT_TEMPLATE;
    const hasBreakdownPlaceholder = template.includes('{breakdown}');

    let message = template
      .replace(/\{name\}/g, client.name)
      .replace(/\{amount\}/g, amountStr)
      .replace(/\{fy\}/g, fyName || 'current year')
      .replace(/\{category\}/g, category);

    if (hasBreakdownPlaceholder) {
      // Inline {breakdown}: replace, and collapse surrounding blank line when empty
      message = breakdownBlock
        ? message.replace(/\{breakdown\}/g, breakdownBlock)
        : message.replace(/\n?\{breakdown\}\n?/g, '');
    } else if (otherItems.length > 0) {
      // Legacy templates: append breakdown after the message body
      const lines: string[] = [];
      if (client.quotedFees) lines.push(`  • ITR Filing Fees: ${formatINR(client.quotedFees)}`);
      for (const item of otherItems) lines.push(`  • ${item.type || 'Other Dues'}: ${formatINR(item.amount)}`);
      if (lines.length > 1) lines.push(`  Total: ${formatINR(totalFees)}`);
      if (received > 0) lines.push(`  Received: ${formatINR(received)}`);
      lines.push(`  Pending: ${amountStr}`);
      message += `\n\nFees breakdown:\n${lines.join('\n')}`;
    }

    if (upiId && pending !== null && pending > 0)
      message += `\n\nPay ${amountStr} via UPI:\nUPI ID: ${upiId}`;

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

  // ── Computed display values ────────────────────────────────────────────────
  const draftDuesTotal = draft.duesItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const draftTotal     = (parseFloat(draft.quotedFees) || 0) + draftDuesTotal;

  // Header pills always show persisted (saved) data
  const savedHasOtherDues = (client.otherDues ?? 0) > 0;
  const savedTotal        = (client.quotedFees ?? 0) + (client.otherDues ?? 0);
  const headerFeeDisplay  = savedHasOtherDues ? formatINR(savedTotal) : formatINR(client.quotedFees);
  const receivedDisplay   = formatINR(client.feesReceived);
  const clientTags        = client.tags || [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <AddMobileDialog
        open={showAddMobile}
        onOpenChange={setShowAddMobile}
        clientName={client.name}
        onConfirm={handleSaveMobileAndSend}
      />

      {/* Accordion close guard */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={(o) => { if (!o) setShowUnsavedDialog(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes for <span className="font-medium">{client.name}</span>. What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setShowUnsavedDialog(false)}>Keep Editing</AlertDialogCancel>
            <Button variant="outline" size="sm" onClick={handleDiscardAndClose}
              className="text-destructive border-destructive/40 hover:bg-destructive/10">
              Discard &amp; Close
            </Button>
            <AlertDialogAction onClick={handleSaveAndClose} disabled={saving}
              className="bg-accent hover:bg-accent/90 text-accent-foreground">
              {saving
                ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                : <Save className="w-3.5 h-3.5 mr-1.5" />}
              Save &amp; Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark as done */}
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
            <AlertDialogAction onClick={handleDoneConfirm}
              className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Check className="w-4 h-4 mr-1.5" />Confirm Done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* No service */}
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

      {/* Partial payment / discount chooser */}
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
                  {' '}How should this be recorded?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <button onClick={() => handlePartialChoice('partial')}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-orange-200 bg-orange-50 hover:bg-orange-100 hover:border-orange-400 dark:border-orange-800 dark:bg-orange-950/30 dark:hover:bg-orange-950/60 transition-colors text-left">
              <CreditCard className="w-6 h-6 text-orange-500" />
              <div>
                <p className="font-semibold text-sm">Partial Payment</p>
                <p className="text-xs text-muted-foreground mt-0.5">{partialData && formatINR(partialData.diff)} still pending</p>
              </div>
            </button>
            <button onClick={() => handlePartialChoice('discount')}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 dark:border-blue-800 dark:bg-blue-950/30 dark:hover:bg-blue-950/60 transition-colors text-left">
              <Tag className="w-6 h-6 text-blue-500" />
              <div>
                <p className="font-semibold text-sm">Discount</p>
                <p className="text-xs text-muted-foreground mt-0.5">{partialData && formatINR(partialData.diff)} discount given</p>
              </div>
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
        {/* Collapsed header */}
        <div
          className="flex items-start gap-3 px-4 py-3 cursor-pointer select-none hover:bg-accent/5 transition-colors"
          onClick={handleToggleOpen}
        >
          <span className="text-muted-foreground shrink-0 mt-0.5">
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm block truncate">{client.name}</span>
              {isDirty && (
                <span
                  className="shrink-0 inline-block w-1.5 h-1.5 rounded-full bg-orange-400"
                  title="Unsaved changes"
                />
              )}
            </div>
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
              <span
                className="hidden sm:inline text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded"
                title={savedHasOtherDues ? 'Total (Quoted + Other Dues)' : 'Quoted Fees'}>
                {savedHasOtherDues && <span className="mr-0.5 opacity-60">∑</span>}{headerFeeDisplay}
              </span>
            )}
            {receivedDisplay && (
              <span className="hidden sm:inline text-xs font-mono font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded">
                {receivedDisplay}
              </span>
            )}
          </div>

          {/* Action buttons — stopPropagation so they don't toggle the accordion */}
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" onClick={handleDoneClick} disabled={saving || exiting}
              className="h-7 w-7 px-0 sm:w-auto sm:px-2.5 text-xs bg-accent hover:bg-accent/90 text-accent-foreground"
              data-testid={`button-mark-paid-${client.id}`}>
              <Check className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Done</span>
            </Button>
            <Button size="icon"
              variant={client.itrFiled ? 'default' : 'outline'}
              onClick={handleToggleOpen}
              title={client.itrFiled ? 'ITR Filed — open to edit' : 'Not filed — open to edit'}
              className={client.itrFiled
                ? 'h-7 w-7 shrink-0 bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
                : 'h-7 w-7 shrink-0 text-blue-600 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950'}
              data-testid={`button-itr-filed-${client.id}`}>
              <FileCheck2 className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="outline" onClick={handleWhatsApp}
              disabled={saving || exiting}
              title={client.mobile ? `WhatsApp ${client.name}` : 'No mobile number saved'}
              className="h-7 w-7 shrink-0 text-[#25D366] border-[#25D366]/40 hover:bg-[#25D366]/10 dark:hover:bg-[#25D366]/20"
              data-testid={`button-whatsapp-${client.id}`}>
              <WhatsAppIcon className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Expanded body */}
        {open && (
          <div className="border-t border-border px-4 py-4 bg-card space-y-4">

            {/* Quoted Fees + Other Dues */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Quoted Fees */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Quoted Fees</label>
                <Input
                  type="number"
                  value={draft.quotedFees}
                  onChange={(e) => setDraft(d => ({ ...d, quotedFees: e.target.value }))}
                  placeholder="0"
                  className="font-mono"
                  data-testid={`input-quoted-${client.id}`}
                />
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {FIXED_FEE_PILLS.map((fee) => (
                    <button key={fee}
                      onClick={() => setDraft(d => ({ ...d, quotedFees: fee.toString() }))}
                      className="text-xs px-2 py-0.5 rounded-full border border-border bg-muted hover:bg-accent/20 hover:border-accent/40 text-muted-foreground hover:text-foreground transition-colors font-mono"
                      title={`Set to ${formatINR(fee)}`}>
                      {formatINR(fee)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Other Dues */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Other Dues</label>
                  <button
                    onClick={() => setDraft(d => ({
                      ...d,
                      duesItems: [...d.duesItems, { id: crypto.randomUUID(), amount: '', type: 'Other Dues' }],
                    }))}
                    className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    title="Add another due">
                    <Plus className="w-3 h-3" />Add
                  </button>
                </div>
                {draft.duesItems.length === 0 ? (
                  <button
                    onClick={() => setDraft(d => ({
                      ...d,
                      duesItems: [{ id: crypto.randomUUID(), amount: '', type: 'Other Dues' }],
                    }))}
                    className="w-full h-9 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:border-accent/50 hover:text-foreground transition-colors">
                    <Plus className="w-3.5 h-3.5" />Add other due
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    {draft.duesItems.map((item) => (
                      <div key={item.id} className="flex gap-1.5 items-center">
                        <Input
                          type="number"
                          value={item.amount}
                          onChange={(e) => setDraft(d => ({
                            ...d,
                            duesItems: d.duesItems.map(i => i.id === item.id ? { ...i, amount: e.target.value } : i),
                          }))}
                          placeholder="0"
                          className="font-mono w-24 shrink-0"
                          data-testid={`input-other-dues-${client.id}`}
                        />
                        <Input
                          value={item.type}
                          onChange={(e) => setDraft(d => ({
                            ...d,
                            duesItems: d.duesItems.map(i => i.id === item.id ? { ...i, type: e.target.value } : i),
                          }))}
                          placeholder="Other Dues"
                          className="flex-1 min-w-0 text-sm"
                        />
                        <button
                          onClick={() => setDraft(d => ({ ...d, duesItems: d.duesItems.filter(i => i.id !== item.id) }))}
                          className="shrink-0 h-9 w-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Remove">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {draftDuesTotal > 0 && (
                      <p className="text-xs text-muted-foreground font-mono">
                        Total: <span className="font-semibold text-foreground">{formatINR(draftTotal)}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Fees Received */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Fees Received</label>
              <div className="flex gap-1">
                <Button size="icon" variant="outline" onClick={handleCheckFees}
                  disabled={!draft.quotedFees && draftDuesTotal === 0}
                  className="shrink-0 h-9 w-9 text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950"
                  title="Fill with total fees"
                  data-testid={`button-check-fees-${client.id}`}>
                  <Check className="w-4 h-4" />
                </Button>
                <Input
                  type="number"
                  value={draft.feesReceived}
                  onChange={(e) => setDraft(d => ({ ...d, feesReceived: e.target.value }))}
                  placeholder="0"
                  className="font-mono flex-1"
                  data-testid={`input-received-${client.id}`}
                />
              </div>
            </div>

            {/* ITR Filed toggle */}
            <div>
              <button
                onClick={() => setDraft(d => ({ ...d, itrFiled: !d.itrFiled }))}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                  draft.itrFiled
                    ? 'bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                    : 'border-border text-muted-foreground hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950'
                }`}
                data-testid={`button-itr-filed-body-${client.id}`}>
                <FileCheck2 className="w-4 h-4" />
                <span className="text-xs">{draft.itrFiled ? 'ITR Filed ✓' : 'Mark ITR Filed'}</span>
              </button>
            </div>

            {/* Tags */}
            <TagSelector
              selectedTags={draft.tags}
              allTags={allTags}
              onChange={(tags) => setDraft(d => ({ ...d, tags }))}
            />

            {/* Save / Cancel bar */}
            {isDirty && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 px-3 py-2">
                <p className="text-xs text-orange-700 dark:text-orange-400 font-medium">Unsaved changes</p>
                <div className="flex gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saving}
                    className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground">
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}
                    className="h-7 px-2.5 text-xs bg-accent hover:bg-accent/90 text-accent-foreground">
                    {saving
                      ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Saving…</>
                      : <><Save className="w-3 h-3 mr-1" />Save Changes</>}
                  </Button>
                </div>
              </div>
            )}

            {/* No Service */}
            <div className="flex justify-end">
              <Button size="sm" variant="outline"
                onClick={() => setShowNoServiceDialog(true)}
                disabled={saving || exiting}
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
