import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Settings, Upload, UserPlus, Tags, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { createClient, updateUserSettings, useUserSettings, DEFAULT_TAGS } from '@/hooks/useFirestore';
import { TagChip } from './TagSelector';
import { toast } from 'sonner';

interface SettingsMenuProps {
  uid: string;
  fyId: string | null;
}

export function SettingsMenu({ uid, fyId }: SettingsMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  // Add client
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [adding, setAdding] = useState(false);

  // Manage tags
  const [showManageTags, setShowManageTags] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const { customTags } = useUserSettings(uid || undefined);

  // ── Excel import ────────────────────────────────────────────────────────────
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!fyId) { toast.error('Please select a financial year first'); return; }
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
        if (row?.[0]) { const name = String(row[0]).trim(); if (name) names.push(name); }
      }
      if (names.length === 0) { toast.error('No client names found in the file'); return; }
      let ok = 0;
      for (const name of names) { try { await createClient(uid, fyId, name); ok++; } catch { /* skip */ } }
      toast.success(`Imported ${ok} client${ok !== 1 ? 's' : ''}`);
    } catch { toast.error('Failed to import file'); }
    finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }

  // ── Add single client ───────────────────────────────────────────────────────
  async function handleAddClient() {
    const name = newClientName.trim();
    if (!name) return;
    if (!fyId) { toast.error('Please select a financial year first'); return; }
    setAdding(true);
    try {
      await createClient(uid, fyId, name);
      toast.success(`"${name}" added`);
      setNewClientName('');
      setShowAddClient(false);
    } catch { toast.error('Failed to add client'); }
    finally { setAdding(false); }
  }

  // ── Manage custom tags ──────────────────────────────────────────────────────
  async function handleAddTag() {
    const tag = newTagName.trim();
    if (!tag) return;
    if (DEFAULT_TAGS.includes(tag)) { toast.error(`"${tag}" is a built-in tag`); return; }
    if (customTags.includes(tag)) { toast.error(`"${tag}" already exists`); return; }
    if (!uid) return;
    try {
      await updateUserSettings(uid, { customTags: [...customTags, tag] });
      setNewTagName('');
      toast.success(`Tag "${tag}" created`);
    } catch { toast.error('Failed to save tag'); }
  }

  async function handleRemoveCustomTag(tag: string) {
    if (!uid) return;
    try {
      await updateUserSettings(uid, { customTags: customTags.filter((t) => t !== tag) });
      toast.success(`Tag "${tag}" removed`);
    } catch { toast.error('Failed to remove tag'); }
  }

  return (
    <>
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" data-testid="input-excel-file" />

      {/* ── Add Client Dialog ── */}
      <Dialog open={showAddClient} onOpenChange={(o) => { setShowAddClient(o); if (!o) setNewClientName(''); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Client</DialogTitle>
            <DialogDescription>Enter the client's name to add them to the current financial year.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input autoFocus placeholder="Client name" value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddClient(); if (e.key === 'Escape') { setShowAddClient(false); setNewClientName(''); } }}
              data-testid="input-new-client-name" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddClient(false); setNewClientName(''); }}>Cancel</Button>
            <Button onClick={handleAddClient} disabled={adding || !newClientName.trim()} data-testid="button-confirm-add-client">
              {adding ? 'Adding…' : 'Add Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manage Tags Dialog ── */}
      <Dialog open={showManageTags} onOpenChange={(o) => { setShowManageTags(o); if (!o) setNewTagName(''); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Manage Tags</DialogTitle>
            <DialogDescription>Add custom tags to categorise your clients. Built-in tags cannot be removed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Built-in tags (read-only) */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Built-in Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_TAGS.map((tag) => <TagChip key={tag} tag={tag} active />)}
              </div>
            </div>

            {/* Custom tags */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Custom Tags</p>
              {customTags.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No custom tags yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {customTags.map((tag) => (
                    <TagChip key={tag} tag={tag} active onRemove={() => handleRemoveCustomTag(tag)} />
                  ))}
                </div>
              )}
            </div>

            {/* Add new tag */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Add Custom Tag</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); }}
                  className="flex-1"
                  data-testid="input-new-tag-name"
                />
                <Button size="icon" onClick={handleAddTag} disabled={!newTagName.trim()} title="Add tag" data-testid="button-add-tag">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManageTags(false)}>Done</Button>
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
          <DropdownMenuItem onClick={() => setShowAddClient(true)} disabled={!fyId} data-testid="menu-add-client">
            <UserPlus className="w-4 h-4 mr-2 shrink-0" />Add Client
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()} disabled={importing || !fyId} data-testid="menu-import-excel">
            <Upload className="w-4 h-4 mr-2 shrink-0" />
            {importing ? 'Importing…' : 'Import from Excel'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowManageTags(true)} data-testid="menu-manage-tags">
            <Tags className="w-4 h-4 mr-2 shrink-0" />Manage Tags
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
