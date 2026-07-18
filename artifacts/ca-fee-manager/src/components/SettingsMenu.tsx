import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Settings, Plus, Upload, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { createFinancialYear, createClient } from '@/hooks/useFirestore';
import { toast } from 'sonner';

interface SettingsMenuProps {
  uid: string;
  fyId: string | null;
  onYearCreated: (newId: string) => void;
}

/** Auto-inserts a hyphen after the 4th digit and strips non-numeric (except the hyphen). */
function formatFYInput(raw: string, prev: string): string {
  // Allow deleting past the hyphen naturally
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}`;
}

export function SettingsMenu({ uid, fyId, onYearCreated }: SettingsMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [newFYOpen, setNewFYOpen] = useState(false);
  const [fyName, setFyName] = useState('');
  const [prevFyName, setPrevFyName] = useState('');
  const [creating, setCreating] = useState(false);

  // ── New FY ──────────────────────────────────────────────────────────
  function handleFyInput(value: string) {
    const formatted = formatFYInput(value, prevFyName);
    setPrevFyName(formatted);
    setFyName(formatted);
  }

  async function handleCreateFY() {
    const fyPattern = /^\d{4}-\d{4}$/;
    if (!fyPattern.test(fyName)) {
      toast.error('Use format YYYY-YYYY (e.g. 2025-2026)');
      return;
    }
    setCreating(true);
    try {
      const newId = await createFinancialYear(uid, fyName);
      toast.success(`Created ${fyName}`);
      onYearCreated(newId);
      setNewFYOpen(false);
      setFyName('');
    } catch {
      toast.error('Failed to create financial year');
    } finally {
      setCreating(false);
    }
  }

  // ── Excel Import ─────────────────────────────────────────────────────
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!fyId) {
      toast.error('Please select a financial year first');
      return;
    }

    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      const names: string[] = [];
      let skipFirst = false;
      if (jsonData.length > 0 && Array.isArray(jsonData[0])) {
        const firstCell = String((jsonData[0] as any[])[0] || '').toLowerCase();
        if (firstCell.includes('name') || firstCell.includes('client')) skipFirst = true;
      }

      for (let i = skipFirst ? 1 : 0; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (row?.[0]) {
          const name = String(row[0]).trim();
          if (name) names.push(name);
        }
      }

      if (names.length === 0) {
        toast.error('No client names found in the file');
        return;
      }

      let ok = 0;
      for (const name of names) {
        try { await createClient(uid, fyId, name); ok++; } catch { /* skip */ }
      }
      toast.success(`Imported ${ok} client${ok !== 1 ? 's' : ''}`);
    } catch {
      toast.error('Failed to import file');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="input-excel-file"
      />

      {/* Settings dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" title="Settings" data-testid="button-settings">
            <Settings className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Manage</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => { setFyName(''); setNewFYOpen(true); }}
            data-testid="menu-new-fy"
          >
            <Plus className="w-4 h-4 mr-2 shrink-0" />
            New Financial Year
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => fileInputRef.current?.click()}
            disabled={importing || !fyId}
            data-testid="menu-import-excel"
          >
            <Upload className="w-4 h-4 mr-2 shrink-0" />
            {importing ? 'Importing…' : 'Import from Excel'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* New FY dialog */}
      <Dialog open={newFYOpen} onOpenChange={setNewFYOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Financial Year</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label htmlFor="fy-name" className="text-sm font-medium">
                Financial Year
              </label>
              <Input
                id="fy-name"
                value={fyName}
                onChange={(e) => handleFyInput(e.target.value)}
                placeholder="2025-2026"
                maxLength={9}
                className="font-mono tracking-wide"
                data-testid="input-fy-name"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFY(); }}
              />
              <p className="text-xs text-muted-foreground">
                Type the start year — the hyphen is added automatically.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewFYOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreateFY} disabled={creating} data-testid="button-create-fy">
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
