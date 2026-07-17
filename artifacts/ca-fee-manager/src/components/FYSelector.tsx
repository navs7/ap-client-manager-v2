import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FinancialYear, createFinancialYear } from '@/hooks/useFirestore';
import { toast } from 'sonner';

interface FYSelectorProps {
  years: FinancialYear[];
  selectedYearId: string | null;
  onSelectYear: (yearId: string) => void;
  uid: string;
}

export function FYSelector({
  years,
  selectedYearId,
  onSelectYear,
  uid,
}: FYSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newYearName, setNewYearName] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreateYear() {
    if (!newYearName.trim()) {
      toast.error('Please enter a financial year name');
      return;
    }

    // Validate format (optional but recommended)
    const fyPattern = /^FY \d{4}-\d{4}$/;
    if (!fyPattern.test(newYearName)) {
      toast.error('Please use format: FY YYYY-YYYY (e.g., FY 2025-2026)');
      return;
    }

    setCreating(true);
    try {
      const newId = await createFinancialYear(uid, newYearName);
      toast.success(`Created ${newYearName}`);
      onSelectYear(newId);
      setDialogOpen(false);
      setNewYearName('');
    } catch (error) {
      toast.error('Failed to create financial year');
      console.error(error);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <Select value={selectedYearId || undefined} onValueChange={onSelectYear}>
            <SelectTrigger data-testid="select-fy">
              <SelectValue placeholder="Select Financial Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year.id} value={year.id}>
                  {year.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={() => setDialogOpen(true)}
          data-testid="button-new-fy"
        >
          <Plus className="w-4 h-4 mr-2" />
          New FY
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Financial Year</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="fy-name" className="text-sm font-medium">
                Financial Year Name
              </label>
              <Input
                id="fy-name"
                value={newYearName}
                onChange={(e) => setNewYearName(e.target.value)}
                placeholder="FY 2025-2026"
                data-testid="input-fy-name"
              />
              <p className="text-xs text-muted-foreground">
                Use format: FY YYYY-YYYY
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateYear}
              disabled={creating}
              data-testid="button-create-fy"
            >
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
