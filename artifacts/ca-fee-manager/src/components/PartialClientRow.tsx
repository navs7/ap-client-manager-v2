import { useState } from 'react';
import { Client, updateClient } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Undo2, ChevronDown, ChevronRight, CheckCircle2, FileCheck2 } from 'lucide-react';

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
import { toast } from 'sonner';
import { HistoryLog } from './HistoryLog';
import { CommentInput } from './CommentInput';

interface PartialClientRowProps {
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

export function PartialClientRow({ client, uid, fyId }: PartialClientRowProps) {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showPaidDialog, setShowPaidDialog] = useState(false);

  async function handleItrFiled() {
    const entry = { id: crypto.randomUUID(), at: new Date().toISOString(), action: 'ITR Filed' };
    await updateClient(uid, fyId, client.id, { history: [...(client.history || []), entry] });
    toast.success(`ITR filed noted for ${client.name}`);
  }

  async function handleAddComment(text: string) {
    const entry = { id: crypto.randomUUID(), at: new Date().toISOString(), action: `Note: ${text}` };
    await updateClient(uid, fyId, client.id, { history: [...(client.history || []), entry] });
  }

  const pending =
    client.quotedFees !== null && client.feesReceived !== null
      ? client.quotedFees - client.feesReceived
      : null;

  async function handlePaidInFull() {
    setShowPaidDialog(false);
    setUpdating(true);
    try {
      const entry = { id: crypto.randomUUID(), at: new Date().toISOString(), action: 'Marked as Paid in Full' };
      await updateClient(uid, fyId, client.id, {
        status: 'paid',
        history: [...(client.history || []), entry],
      });
      toast.success(`${client.name} marked as paid in full`);
    } catch { toast.error('Failed to update status'); }
    finally { setUpdating(false); }
  }

  async function handleUndo() {
    setUpdating(true);
    try {
      const entry = { id: crypto.randomUUID(), at: new Date().toISOString(), action: 'Moved back to Pending (partial payment cleared)' };
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
    <>
      <AlertDialog open={showPaidDialog} onOpenChange={setShowPaidDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Paid in Full?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">{client.name}</span> will be moved to{' '}
              <span className="font-medium">Fees Paid</span>.
              {pending !== null && pending > 0 && (
                <> The remaining <span className="font-semibold text-foreground">{formatINR(pending)}</span> will be considered settled.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePaidInFull}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />Confirm Paid in Full
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div
        className="border border-orange-200 dark:border-orange-800 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 overflow-hidden transition-shadow hover:shadow-sm status-transition row-enter"
        data-testid={`partial-client-row-${client.id}`}
      >
        {/* Collapsed Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-orange-100/50 dark:hover:bg-orange-950/40 transition-colors"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="text-muted-foreground shrink-0">
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
          <span className="font-semibold text-sm flex-1 truncate">{client.name}</span>

          <div className="flex items-center gap-2 shrink-0">
            {/* Received */}
            {client.feesReceived !== null && (
              <span className="hidden sm:inline text-xs font-mono font-semibold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 rounded">
                {formatINR(client.feesReceived)} paid
              </span>
            )}
            {/* Pending */}
            {pending !== null && pending > 0 && (
              <span className="hidden sm:inline text-xs font-mono text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded border border-red-200 dark:border-red-800">
                {formatINR(pending)} pending
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              onClick={() => setShowPaidDialog(true)}
              disabled={updating}
              className="h-7 px-2.5 text-xs bg-accent hover:bg-accent/90 text-accent-foreground"
              data-testid={`button-paid-full-${client.id}`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Paid in Full
            </Button>
            <Button
              size="icon" variant="outline" onClick={handleItrFiled} disabled={updating}
              title="ITR Filed"
              className="h-7 w-7 text-blue-600 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950"
              data-testid={`button-itr-partial-${client.id}`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm" variant="outline" onClick={handleUndo} disabled={updating}
              className="h-7 px-2.5 text-xs"
              data-testid={`button-undo-partial-${client.id}`}
            >
              <Undo2 className="w-3.5 h-3.5 mr-1" />Undo
            </Button>
          </div>
        </div>

        {/* Expanded Body */}
        {open && (
          <div className="border-t border-orange-200 dark:border-orange-800 px-4 py-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Quoted Fees</p>
                <p className="text-sm font-mono font-medium">{formatINR(client.quotedFees)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Received</p>
                <p className="text-sm font-mono font-semibold text-orange-600 dark:text-orange-400">
                  {formatINR(client.feesReceived)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Pending</p>
                <p className="text-sm font-mono font-semibold text-red-600 dark:text-red-400">
                  {pending !== null ? formatINR(pending) : '—'}
                </p>
              </div>
            </div>
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
