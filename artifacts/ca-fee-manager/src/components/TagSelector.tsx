import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

// ── Color palette (hashed by tag name for consistency) ──────────────────────
const TAG_PALETTE = [
  { bg: 'bg-green-100 dark:bg-green-950',  text: 'text-green-700 dark:text-green-300',  border: 'border-green-200 dark:border-green-800'  },
  { bg: 'bg-blue-100 dark:bg-blue-950',    text: 'text-blue-700 dark:text-blue-300',    border: 'border-blue-200 dark:border-blue-800'    },
  { bg: 'bg-purple-100 dark:bg-purple-950',text: 'text-purple-700 dark:text-purple-300',border: 'border-purple-200 dark:border-purple-800' },
  { bg: 'bg-orange-100 dark:bg-orange-950',text: 'text-orange-700 dark:text-orange-300',border: 'border-orange-200 dark:border-orange-800' },
  { bg: 'bg-red-100 dark:bg-red-950',      text: 'text-red-700 dark:text-red-300',      border: 'border-red-200 dark:border-red-800'      },
  { bg: 'bg-yellow-100 dark:bg-yellow-950',text: 'text-yellow-700 dark:text-yellow-800',border: 'border-yellow-200 dark:border-yellow-800' },
  { bg: 'bg-teal-100 dark:bg-teal-950',    text: 'text-teal-700 dark:text-teal-300',    border: 'border-teal-200 dark:border-teal-800'    },
  { bg: 'bg-pink-100 dark:bg-pink-950',    text: 'text-pink-700 dark:text-pink-300',    border: 'border-pink-200 dark:border-pink-800'    },
];

function hashStr(s: string): number {
  return s.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

export function getTagColor(tag: string) {
  return TAG_PALETTE[hashStr(tag) % TAG_PALETTE.length];
}

// ── TagChip ──────────────────────────────────────────────────────────────────
interface TagChipProps {
  tag: string;
  onRemove?: () => void;
  onClick?: () => void;
  active?: boolean;
  small?: boolean;
}

export function TagChip({ tag, onRemove, onClick, active, small }: TagChipProps) {
  const c = getTagColor(tag);
  const base = `inline-flex items-center gap-1 font-medium rounded-full border transition-colors ${small ? 'text-[10px] px-1.5 py-px' : 'text-xs px-2 py-0.5'}`;
  const color = active
    ? `${c.bg} ${c.text} ${c.border}`
    : 'bg-muted/60 text-muted-foreground border-border hover:border-primary/40';

  return (
    <span
      className={`${base} ${color} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {tag}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="hover:opacity-70 ml-0.5"
          aria-label={`Remove ${tag}`}
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
}

// ── TagSelector ───────────────────────────────────────────────────────────────
interface TagSelectorProps {
  selectedTags: string[];
  allTags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

export function TagSelector({ selectedTags = [], allTags = [], onChange, disabled }: TagSelectorProps) {
  const [open, setOpen] = useState(false);

  function toggleTag(tag: string) {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter((t) => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">Tags</label>
      <div className="flex flex-wrap gap-1.5 items-center min-h-[28px]">
        {selectedTags.map((tag) => (
          <TagChip
            key={tag}
            tag={tag}
            active
            onRemove={disabled ? undefined : () => onChange(selectedTags.filter((t) => t !== tag))}
          />
        ))}
        {!disabled && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs gap-1 text-muted-foreground border-dashed"
                onClick={(e) => e.stopPropagation()}
              >
                <Plus className="w-3 h-3" />
                {selectedTags.length === 0 ? 'Add tag' : 'Edit'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1.5" align="start" onClick={(e) => e.stopPropagation()}>
              {allTags.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">
                  No tags yet. Add them in Settings → Manage Tags.
                </p>
              ) : (
                <div className="space-y-0.5">
                  {allTags.map((tag) => {
                    const selected = selectedTags.includes(tag);
                    const c = getTagColor(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded transition-colors text-left ${selected ? `${c.bg} ${c.text}` : 'hover:bg-accent/40'}`}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${c.bg.split(' ')[0]} border ${c.border.split(' ')[0]}`} />
                        <span className="flex-1 truncate">{tag}</span>
                        {selected && <Check className="w-3 h-3 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
