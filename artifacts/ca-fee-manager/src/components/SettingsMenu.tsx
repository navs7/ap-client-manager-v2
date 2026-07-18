import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Settings, Upload, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { createClient } from '@/hooks/useFirestore';
import { toast } from 'sonner';

interface SettingsMenuProps {
  uid: string;
  fyId: string | null;
}

export function SettingsMenu({ uid, fyId }: SettingsMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [adding, setAdding] = useState(false);

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

  async function handleAddClient() {
    const name = newClientName.trim();
    if (!name) return;
    if (!fyId) {
      toast.error('Please select a financial year first');
      return;
    }
    setAdding(true);
    try {
      await createClient(uid, fyId, name);
      toast.success(`"${name}" added`);
      setNewClientName('');
      setShowAddClient(false);
    } catch {
      toast.error('Failed to add client');
    } finally {
      setAdding(false);
    }
  }

  function handleAddClientKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAddClient();
    if (e.key === 'Escape') { setShowAddClient(false); setNewClientName(''); }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="input-excel-file"
      />

      {/* Add Client Dialog */}
      <Dialog open={showAddClient} onOpenChange={(o) => { setShowAddClient(o); if (!o) setNewClientName(''); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Client</DialogTitle>
            <DialogDescription>
              Enter the client's name to add them to the current financial year.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              autoFocus
              placeholder="Client name"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              onKeyDown={handleAddClientKeyDown}
              data-testid="input-new-client-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddClient(false); setNewClientName(''); }}>
              Cancel
            </Button>
            <Button
              onClick={handleAddClient}
              disabled={adding || !newClientName.trim()}
              data-testid="button-confirm-add-client"
            >
              {adding ? 'Adding…' : 'Add Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" title="Settings" data-testid="button-settings">
            <Settings className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Manage</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowAddClient(true)}
            disabled={!fyId}
            data-testid="menu-add-client"
          >
            <UserPlus className="w-4 h-4 mr-2 shrink-0" />
            Add Client
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
    </>
  );
}
