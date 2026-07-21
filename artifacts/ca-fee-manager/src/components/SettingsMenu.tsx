import { useRef, useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import * as XLSX from 'xlsx';
import { Settings, Upload, UserPlus, Tags, Plus, Trash2, Search, X, FileDown, BarChart2, MessageSquare, Check, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { createClient, deleteClient, updateUserSettings, useUserSettings, DEFAULT_TAGS, DEFAULT_WA_MESSAGES, Client } from '@/hooks/useFirestore';
import { TagChip } from './TagSelector';
import { toast } from 'sonner';

interface SettingsMenuProps {
  uid: string;
  fyId: string | null;
  clients: Client[];
}

const STATUS_LABELS: Record<Client['status'], { label: string; className: string }> = {
  pending:    { label: 'Pending',    className: 'bg-muted text-muted-foreground border-border' },
  partial:    { label: 'Partial',    className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800' },
  paid:       { label: 'Paid',       className: 'bg-accent/10 text-accent border-accent/30' },
  no_service: { label: 'No Service', className: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800' },
};

export function SettingsMenu({ uid, fyId, clients }: SettingsMenuProps) {
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  // Add client
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [adding, setAdding] = useState(false);

  // Manage tags
  const [showManageTags, setShowManageTags] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const { customTags, waMessages, waTemplate } = useUserSettings(uid || undefined);

  // WhatsApp message templates
  const [showWAMessages, setShowWAMessages] = useState(false);
  const [selectedMsgKey, setSelectedMsgKey] = useState<string | null>(null); // 'builtin-0'..'builtin-4' | 'saved-0'..'saved-n'
  const [editText, setEditText] = useState('');
  const [savingTpl, setSavingTpl] = useState(false);

  // Delete clients
  const [showDeleteClients, setShowDeleteClients] = useState(false);
  const [deleteSearch, setDeleteSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredForDelete = useMemo(() => {
    const q = deleteSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [clients, deleteSearch]);

  // ── Sample Excel download ───────────────────────────────────────────────────
  function downloadSampleExcel() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Client Name', 'Mobile Number'],
      ['Rahul Sharma',  '9876543210'],
      ['Priya Patel',   '9123456780'],
      ['Amit Gupta',    '9988776655'],
      ['Sunita Joshi',  '9871234560'],
      ['Vikram Singh',  '9000011112'],
      ['Deepa Mehta',   '9111222333'],
      ['Arun Kumar',    '9444555666'],
    ]);
    ws['!cols'] = [{ wch: 30 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');
    XLSX.writeFile(wb, 'client-import-sample.xlsx');
  }

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
      const rows: { name: string; mobile: string | null }[] = [];
      for (let i = skipFirst ? 1 : 0; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (row?.[0]) {
          const name = String(row[0]).trim();
          if (!name) continue;
          const rawMobile = row[1] != null ? String(row[1]).trim() : null;
          const mobile = rawMobile || null;
          rows.push({ name, mobile });
        }
      }
      if (rows.length === 0) { toast.error('No client names found in the file'); return; }
      let ok = 0;
      for (const { name, mobile } of rows) { try { await createClient(uid, fyId, name, mobile); ok++; } catch { /* skip */ } }
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

  // ── Delete client ───────────────────────────────────────────────────────────
  async function handleConfirmDelete() {
    if (!pendingDelete || !fyId) return;
    setDeleting(true);
    try {
      await deleteClient(uid, fyId, pendingDelete.id);
      toast.success(`"${pendingDelete.name}" deleted`);
      setPendingDelete(null);
    } catch { toast.error('Failed to delete client'); }
    finally { setDeleting(false); }
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

  // ── WhatsApp message templates ──────────────────────────────────────────────
  function openWAMessages() {
    // Pre-select whatever is currently active
    if (waTemplate) {
      const builtinIdx = DEFAULT_WA_MESSAGES.indexOf(waTemplate);
      if (builtinIdx !== -1) {
        setSelectedMsgKey(`builtin-${builtinIdx}`);
      } else {
        const savedIdx = waMessages.indexOf(waTemplate);
        setSelectedMsgKey(savedIdx !== -1 ? `saved-${savedIdx}` : null);
      }
      setEditText(waTemplate);
    } else {
      setSelectedMsgKey('builtin-0');
      setEditText(DEFAULT_WA_MESSAGES[0]);
    }
    setShowWAMessages(true);
  }

  function selectMessage(key: string, text: string) {
    setSelectedMsgKey(key);
    setEditText(text);
  }

  async function handleSetActiveTemplate() {
    const text = editText.trim();
    if (!text || !uid) return;
    setSavingTpl(true);
    try {
      await updateUserSettings(uid, { waTemplate: text });
      toast.success('WhatsApp template updated');
    } catch { toast.error('Failed to save template'); }
    finally { setSavingTpl(false); }
  }

  async function handleSaveNewMessage() {
    const text = editText.trim();
    if (!text || !uid) return;
    if (DEFAULT_WA_MESSAGES.includes(text)) { toast.error('This is already a built-in message'); return; }
    if (waMessages.includes(text)) { toast.error('This message is already saved'); return; }
    setSavingTpl(true);
    try {
      const updated = [...waMessages, text];
      await updateUserSettings(uid, { waMessages: updated, waTemplate: text });
      setSelectedMsgKey(`saved-${updated.length - 1}`);
      toast.success('Message saved and set as active');
    } catch { toast.error('Failed to save message'); }
    finally { setSavingTpl(false); }
  }

  async function handleDeleteSavedMessage(index: number) {
    if (!uid) return;
    const updated = waMessages.filter((_, i) => i !== index);
    try {
      const deletedText = waMessages[index];
      const newTemplate = waTemplate === deletedText ? null : waTemplate;
      await updateUserSettings(uid, { waMessages: updated, waTemplate: newTemplate });
      if (selectedMsgKey === `saved-${index}`) {
        setSelectedMsgKey('builtin-0');
        setEditText(DEFAULT_WA_MESSAGES[0]);
      }
      toast.success('Message deleted');
    } catch { toast.error('Failed to delete message'); }
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

      {/* ── Delete Clients Dialog ── */}
      <Dialog open={showDeleteClients} onOpenChange={(o) => { setShowDeleteClients(o); if (!o) setDeleteSearch(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Clients</DialogTitle>
            <DialogDescription>
              Permanently remove a client and all their data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {/* Search within dialog */}
          {clients.length > 5 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search clients…"
                value={deleteSearch}
                onChange={(e) => setDeleteSearch(e.target.value)}
                className="pl-9 pr-8"
              />
              {deleteSearch && (
                <button onClick={() => setDeleteSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Client list */}
          <div className="max-h-[340px] overflow-y-auto -mx-1 px-1 space-y-1">
            {clients.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No clients in this financial year.</p>
            ) : filteredForDelete.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">No clients match "{deleteSearch}".</p>
            ) : (
              filteredForDelete.map((client) => {
                const s = STATUS_LABELS[client.status];
                return (
                  <div
                    key={client.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">{client.name}</span>
                    </div>
                    <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded border ${s.className}`}>
                      {s.label}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setPendingDelete(client)}
                      className="shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      title={`Delete ${client.name}`}
                      data-testid={`button-delete-client-${client.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteClients(false); setDeleteSearch(''); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => { if (!o) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="font-medium text-foreground">{pendingDelete?.name}</span> and all their history, fees, and notes. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              variant="destructive"
              className="gap-1.5"
              data-testid="button-confirm-delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleting ? 'Deleting…' : 'Delete Client'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── WhatsApp Messages Dialog ── */}
      <Dialog open={showWAMessages} onOpenChange={(o) => { setShowWAMessages(o); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>WhatsApp Message Templates</DialogTitle>
            <DialogDescription>
              Select a template to use when sending WhatsApp reminders. Use{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">{'{name}'}</code>,{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">{'{amount}'}</code>, and{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">{'{fy}'}</code> as placeholders.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {/* Built-in messages */}
            <p className="text-xs font-medium text-muted-foreground">Built-in Templates</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {DEFAULT_WA_MESSAGES.map((msg, i) => {
                const key = `builtin-${i}`;
                const isActive = waTemplate === msg || (!waTemplate && i === 0);
                const isSelected = selectedMsgKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => selectMessage(key, msg)}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border hover:bg-muted/60 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex-1 line-clamp-2 leading-snug">{msg}</span>
                      {isActive && <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Saved messages */}
            {waMessages.length > 0 && (
              <>
                <p className="text-xs font-medium text-muted-foreground">Saved Messages</p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {waMessages.map((msg, i) => {
                    const key = `saved-${i}`;
                    const isActive = waTemplate === msg;
                    const isSelected = selectedMsgKey === key;
                    return (
                      <div key={key} className="flex items-start gap-1.5">
                        <button
                          onClick={() => selectMessage(key, msg)}
                          className={`flex-1 text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                            isSelected
                              ? 'border-primary bg-primary/5 text-foreground'
                              : 'border-border hover:bg-muted/60 text-muted-foreground'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="flex-1 line-clamp-2 leading-snug">{msg}</span>
                            {isActive && <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />}
                          </div>
                        </button>
                        <button
                          onClick={() => handleDeleteSavedMessage(i)}
                          className="shrink-0 mt-2 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete this message"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Edit area */}
            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Pencil className="w-3 h-3" /> Edit &amp; Compose
              </p>
              <textarea
                className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring min-h-[90px]"
                value={editText}
                onChange={(e) => { setEditText(e.target.value); setSelectedMsgKey(null); }}
                placeholder="Type your message… use {name}, {amount}, {fy}"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleSaveNewMessage}
              disabled={savingTpl || !editText.trim()}
              className="w-full sm:w-auto"
            >
              Save as New Message
            </Button>
            <Button
              onClick={handleSetActiveTemplate}
              disabled={savingTpl || !editText.trim()}
              className="w-full sm:w-auto"
            >
              {savingTpl ? 'Saving…' : 'Use This Template'}
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
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Built-in Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_TAGS.map((tag) => <TagChip key={tag} tag={tag} active />)}
              </div>
            </div>
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
          <DropdownMenuItem onClick={downloadSampleExcel} data-testid="menu-sample-excel">
            <FileDown className="w-4 h-4 mr-2 shrink-0" />Download Sample
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowDeleteClients(true)}
            disabled={!fyId || clients.length === 0}
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
            data-testid="menu-delete-clients"
          >
            <Trash2 className="w-4 h-4 mr-2 shrink-0" />Delete Clients
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowManageTags(true)} data-testid="menu-manage-tags">
            <Tags className="w-4 h-4 mr-2 shrink-0" />Manage Tags
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openWAMessages} data-testid="menu-wa-messages">
            <MessageSquare className="w-4 h-4 mr-2 shrink-0" />WhatsApp Messages
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/analytics')} data-testid="menu-analytics">
            <BarChart2 className="w-4 h-4 mr-2 shrink-0" />Analytics
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
