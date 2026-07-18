import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Settings, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { createClient } from '@/hooks/useFirestore';
import { toast } from 'sonner';

interface SettingsMenuProps {
  uid: string;
  fyId: string | null;
}

export function SettingsMenu({ uid, fyId }: SettingsMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

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
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="input-excel-file"
      />

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
