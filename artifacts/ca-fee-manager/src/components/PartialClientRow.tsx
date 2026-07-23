import { useState } from 'react';
import { Client, HistoryEntry, updateClient } from '@/hooks/useFirestore';

import { Button } from '@/components/ui/button';
import { Undo2, ChevronDown, ChevronRight, CheckCircle2, FileCheck2 } from 'lucide-react';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>
  );
}
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { HistoryLog } from './HistoryLog';
import { CommentInput } from './CommentInput';
import { TagSelector, TagChip } from './TagSelector';
import { AddMobileDialog } from './AddMobileDialog';

function makeEntry(action: string): HistoryEntry {
  return { id: crypto.randomUUID(), at: new Date().toISOString(), action };
}

function cleanMobile(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return '91' + digits;
  return digits;
}

function formatINRStr(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return 'pending amount';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

interface PartialClientRowProps {
  client: Client;
  uid: string;
  fyId: string;
  fyName: string;
  allTags: string[];
  waTemplate: string;
  upiId: string;
}

function formatINR(amount: number | null | undefined) {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export function PartialClientRow({ client, uid, fyId, fyName, allTags, waTemplate, upiId }: PartialClientRowProps) {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showPaidDialog, setShowPaidDialog] = useState(false);
  const [showAddMobile, setShowAddMobile] = useState(false);

  async function sendWhatsApp(mobile: string) {
    const totalFees = (client.quotedFees ?? 0) + (client.otherDues ?? 0);
    const received = client.feesReceived ?? 0;
    const pendingAmt = totalFees > 0 ? totalFees - received : null;
    const amountStr = pendingAmt !== null && pendingAmt > 0 ? formatINRStr(pendingAmt) : 'pending amount';

    const DEFAULT_TEMPLATE = `Dear {name}, this is a gentle reminder regarding your pending ITR filing fees of {amount} for FY {fy}. Kindly arrange payment at your earliest convenience. Thank you.`;
    const template = waTemplate || DEFAULT_TEMPLATE;
    let message = template
      .replace(/\{name\}/g, client.name)
      .replace(/\{amount\}/g, amountStr)
      .replace(/\{fy\}/g, fyName || 'current year');

    if (upiId && pendingAmt !== null && pendingAmt > 0) {
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

  async function handleItrFiled() {
    const newValue = !client.itrFiled;
    const entry = { id: crypto.randomUUID(), at: new Date().toISOString(), action: newValue ? 'ITR Filed' : 'ITR Status Removed' };
    await updateClient(uid, fyId, client.id, { itrFiled: newValue, history: [...(client.history || []), entry] });
    toast.success(newValue ? `ITR filed for ${client.name}` : `ITR status removed for ${client.name}`);
  }

  async function handleAddComment(text: string) {
    const entry = { id: crypto.randomUUID(), at: new Date().toISOString(), action: `Note: ${text}` };
    await updateClient(uid, fyId, client.id, { history: [...(client.history || []), entry] });
  }

  async function handleTagsChange(tags: string[]) {
    await updateClient(uid, fyId, client.id, { tags });
  }

  const hasOtherDues = (client.otherDues ?? 0) > 0;
  const totalFees = (client.quotedFees ?? 0) + (client.otherDues ?? 0);
  const pending = client.feesReceived !== null ? totalFees - client.feesReceived : null;
  const clientTags = client.tags || [];

  async function handlePaidInFull() {
    setShowPaidDialog(false);
    setUpdating(true);
    try {
      const entry = { id: crypto.randomUUID(), at: new Date().toISOString(), action: 'Marked as Paid in Full' };
      await updateClient(uid, fyId, client.id, { status: 'paid', history: [...(client.history || []), entry] });
      toast.success(`${client.name} marked as paid in full`);
    } catch { toast.error('Failed to update status'); }
    finally { setUpdating(false); }
  }

  async function handleUndo() {
    setUpdating(true);
    try {
      const entry = { id: crypto.randomUUID(), at: new Date().toISOString(), action: 'Moved back to Pending (partial payment cleared)' };
      await updateClient(uid, fyId, client.id, { status: 'pending', paymentType: null, history: [...(client.history || []), entry] });
      toast.success(`${client.name} moved back to pending`);
    } catch { toast.error('Failed to update status'); }
    finally { setUpdating(false); }
  }

  return (
    <>
      <AddMobileDialog
        open={showAddMobile}
        onOpenChange={setShowAddMobile}
        clientName={client.name}
        onConfirm={handleSaveMobileAndSend}
      />

      <AlertDialog open={showPaidDialog} onOpenChange={setShowPaidDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Paid in Full?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">{client.name}</span> will be moved to <span className="font-medium">Fees Paid</span>.
              {pending !== null && pending > 0 && <> The remaining <span className="font-semibold text-foreground">{formatINR(pending)}</span> will be considered settled.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePaidInFull} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <CheckCircle2 className="w-4 h-4 mr-1.5" />Confirm Paid in Full
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="border border-orange-200 dark:border-orange-800 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 overflow-hidden transition-shadow hover:shadow-sm status-transition row-enter" data-testid={`partial-client-row-${client.id}`}>
        {/* Collapsed Header */}
        <div className="flex items-start gap-3 px-4 py-3 cursor-pointer select-none hover:bg-orange-100/50 dark:hover:bg-orange-950/40 transition-colors" onClick={() => setOpen((o) => !o)}>
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
            {client.feesReceived !== null && (
              <span className="hidden sm:inline text-xs font-mono font-semibold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 rounded">
                {formatINR(client.feesReceived)} paid
              </span>
            )}
            {pending !== null && pending > 0 && (
              <span className="hidden sm:inline text-xs font-mono text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded border border-red-200 dark:border-red-800">
                {formatINR(pending)} pending
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" onClick={() => setShowPaidDialog(true)} disabled={updating}
              title="Mark as Paid in Full"
              className="h-7 px-2.5 text-xs bg-accent hover:bg-accent/90 text-accent-foreground" data-testid={`button-paid-full-${client.id}`}>
              <CheckCircle2 className="w-3.5 h-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Paid in Full</span>
            </Button>
            <Button size="icon" variant={client.itrFiled ? 'default' : 'outline'} onClick={handleItrFiled} disabled={updating}
              title={client.itrFiled ? 'ITR Filed — click to unmark' : 'Mark ITR Filed'}
              className={client.itrFiled ? 'h-7 w-7 bg-blue-600 hover:bg-blue-700 text-white border-blue-600' : 'h-7 w-7 text-blue-600 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950'}
              data-testid={`button-itr-partial-${client.id}`}>
              <FileCheck2 className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="outline" onClick={handleWhatsApp} disabled={updating}
              title={client.mobile ? `WhatsApp ${client.name}` : 'No mobile number saved'}
              className={`h-7 w-7 ${client.mobile ? 'text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950' : 'text-muted-foreground opacity-50'}`}>
              <WhatsAppIcon className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="outline" onClick={handleUndo} disabled={updating}
              className="h-7 w-7" title="Undo — move back to Pending" data-testid={`button-undo-partial-${client.id}`}>
              <Undo2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Expanded Body */}
        {open && (
          <div className="border-t border-orange-200 dark:border-orange-800 px-4 py-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Quoted Fees</p>
                <p className="text-sm font-mono font-medium">{formatINR(client.quotedFees)}</p>
              </div>
              {hasOtherDues && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Other Dues</p>
                  <p className="text-sm font-mono font-medium">{formatINR(client.otherDues)}</p>
                </div>
              )}
              {hasOtherDues && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Total</p>
                  <p className="text-sm font-mono font-semibold">{formatINR(totalFees)}</p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Received</p>
                <p className="text-sm font-mono font-semibold text-orange-600 dark:text-orange-400">{formatINR(client.feesReceived)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Pending</p>
                <p className="text-sm font-mono font-semibold text-red-600 dark:text-red-400">{pending !== null ? formatINR(pending) : '—'}</p>
              </div>
            </div>
            <TagSelector selectedTags={clientTags} allTags={allTags} onChange={handleTagsChange} />
            <div className="border-t border-orange-200 dark:border-orange-800 pt-3 space-y-4">
              <CommentInput onSubmit={handleAddComment} />
              <HistoryLog history={client.history} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
