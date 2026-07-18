import { useState } from 'react';
import { Client, updateClient } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Undo2, ChevronDown, ChevronRight, FileCheck2 } from 'lucide-react';
import { toast } from 'sonner';
import { HistoryLog } from './HistoryLog';
import { CommentInput } from './CommentInput';
import { TagSelector, TagChip } from './TagSelector';

interface PaidClientRowProps {
  client: Client;
  uid: string;
  fyId: string;
  allTags: string[];
}

function formatINR(amount: number | null | undefined) {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export function PaidClientRow({ client, uid, fyId, allTags }: PaidClientRowProps) {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

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

  async function handleUndo() {
    setUpdating(true);
    try {
      const entry = { id: crypto.randomUUID(), at: new Date().toISOString(), action: 'Moved back to Pending' };
      await updateClient(uid, fyId, client.id, { status: 'pending', paymentType: null, history: [...(client.history || []), entry] });
      toast.success(`${client.name} moved back to pending`);
    } catch { toast.error('Failed to update status'); }
    finally { setUpdating(false); }
  }

  const hasOtherDues = (client.otherDues ?? 0) > 0;
  const totalFees = (client.quotedFees ?? 0) + (client.otherDues ?? 0);
  const clientTags = client.tags || [];

  return (
    <div className="border border-accent/20 rounded-lg bg-accent/5 overflow-hidden transition-shadow hover:shadow-sm status-transition row-enter" data-testid={`paid-client-row-${client.id}`}>
      {/* Collapsed Header */}
      <div className="flex items-start gap-3 px-4 py-3 cursor-pointer select-none hover:bg-accent/10 transition-colors" onClick={() => setOpen((o) => !o)}>
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
          <span className="hidden sm:inline text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded" title={hasOtherDues ? 'Total Fees' : 'Quoted Fees'}>
            {hasOtherDues && <span className="mr-0.5 opacity-60">∑</span>}
            {hasOtherDues ? formatINR(totalFees) : formatINR(client.quotedFees)}
          </span>
          <span className="hidden sm:inline text-xs font-mono font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded">
            {formatINR(client.feesReceived)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5" onClick={(e) => e.stopPropagation()}>
          <Button size="icon" variant={client.itrFiled ? 'default' : 'outline'} onClick={handleItrFiled} disabled={updating}
            title={client.itrFiled ? 'ITR Filed — click to unmark' : 'Mark ITR Filed'}
            className={client.itrFiled ? 'h-7 w-7 bg-blue-600 hover:bg-blue-700 text-white border-blue-600' : 'h-7 w-7 text-blue-600 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950'}
            data-testid={`button-itr-paid-${client.id}`}>
            <FileCheck2 className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="outline" onClick={handleUndo} disabled={updating}
            className="h-7 w-7" title="Undo — move back to Pending" data-testid={`button-undo-paid-${client.id}`}>
            <Undo2 className="w-3.5 h-3.5" />
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
            {hasOtherDues && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Other Dues</p>
                <p className="text-sm font-mono font-medium">{formatINR(client.otherDues)}</p>
              </div>
            )}
            {hasOtherDues && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Total Fees</p>
                <p className="text-sm font-mono font-semibold">{formatINR(totalFees)}</p>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Fees Received</p>
              <p className="text-sm font-mono font-semibold text-accent">{formatINR(client.feesReceived)}</p>
            </div>
          </div>
          <TagSelector selectedTags={clientTags} allTags={allTags} onChange={handleTagsChange} />
          <div className="border-t border-accent/20 pt-3 space-y-4">
            <CommentInput onSubmit={handleAddComment} />
            <HistoryLog history={client.history} />
          </div>
        </div>
      )}
    </div>
  );
}
