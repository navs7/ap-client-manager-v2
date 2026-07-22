import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

interface AddMobileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  /** Called with the entered mobile string when user confirms. Component handles save + send. */
  onConfirm: (mobile: string) => Promise<void>;
}

export function AddMobileDialog({ open, onOpenChange, clientName, onConfirm }: AddMobileDialogProps) {
  const [mobile, setMobile] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    const val = mobile.trim();
    if (!val) return;
    setSaving(true);
    try {
      await onConfirm(val);
      setMobile('');
    } finally {
      setSaving(false);
    }
  }

  function handleClose(open: boolean) {
    if (!open) setMobile('');
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Mobile Number</DialogTitle>
          <DialogDescription>
            Enter a mobile number for <span className="font-medium text-foreground">{clientName}</span>. It will be saved permanently and WhatsApp will open right after.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Input
            autoFocus
            placeholder="e.g. 9876543210"
            inputMode="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={saving || !mobile.trim()}>
            {saving ? 'Saving…' : 'Save & Open WhatsApp'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
