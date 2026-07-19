import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SendHorizonal } from 'lucide-react';

interface CommentInputProps {
  onSubmit: (text: string) => Promise<void>;
}

export function CommentInput({ onSubmit }: CommentInputProps) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onSubmit(trimmed);
      setText('');
    } finally {
      setSaving(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    // Replace "- " at start of a line with "• "
    const value = e.target.value.replace(/(^|\n)- /g, '$1• ');
    setText(value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
      return;
    }
    if (e.key === 'Enter') {
      // Auto-continue bullet on the next line
      const ta = e.currentTarget;
      const { selectionStart, value } = ta;
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const currentLine = value.substring(lineStart, selectionStart);
      if (currentLine.startsWith('• ')) {
        e.preventDefault();
        const newValue = value.substring(0, selectionStart) + '\n• ' + value.substring(selectionStart);
        setText(newValue);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = selectionStart + 3;
        });
      }
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        Add Comment <span className="font-normal opacity-60">(type <code className="font-mono">-</code> then space for bullets)</span>
      </label>
      <div className="flex gap-2 items-end">
        <textarea
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Add a note… (Ctrl+Enter to submit)"
          rows={2}
          className="flex-1 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[60px]"
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={saving || !text.trim()}
          className="shrink-0 h-9"
        >
          <SendHorizonal className="w-3.5 h-3.5 mr-1.5" />
          {saving ? 'Saving…' : 'Add'}
        </Button>
      </div>
    </div>
  );
}
