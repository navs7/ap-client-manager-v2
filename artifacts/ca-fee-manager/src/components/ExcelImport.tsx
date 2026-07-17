import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { createClient } from '@/hooks/useFirestore';
import { toast } from 'sonner';

interface ExcelImportProps {
  uid: string;
  fyId: string | null;
}

export function ExcelImport({ uid, fyId }: ExcelImportProps) {
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

      // Check if first row is a header
      if (jsonData.length > 0 && Array.isArray(jsonData[0])) {
        const firstCell = String(jsonData[0][0] || '').toLowerCase();
        if (firstCell.includes('name') || firstCell.includes('client')) {
          skipFirst = true;
        }
      }

      // Extract names from first column (column A)
      for (let i = skipFirst ? 1 : 0; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (row && row[0]) {
          const name = String(row[0]).trim();
          if (name) {
            names.push(name);
          }
        }
      }

      if (names.length === 0) {
        toast.error('No client names found in the Excel file');
        return;
      }

      // Create clients in Firestore
      let successCount = 0;
      for (const name of names) {
        try {
          await createClient(uid, fyId, name);
          successCount++;
        } catch (error) {
          console.error(`Failed to create client ${name}:`, error);
        }
      }

      toast.success(`Imported ${successCount} client${successCount !== 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import Excel file');
    } finally {
      setImporting(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
      <Button
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={importing || !fyId}
        data-testid="button-import-excel"
      >
        <Upload className="w-4 h-4 mr-2" />
        {importing ? 'Importing...' : 'Import from Excel'}
      </Button>
    </>
  );
}
