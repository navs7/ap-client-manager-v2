import { HistoryEntry } from '@/hooks/useFirestore';
import { History } from 'lucide-react';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

interface HistoryLogProps {
  history: HistoryEntry[] | undefined;
}

export function HistoryLog({ history }: HistoryLogProps) {
  const entries = history ? [...history].sort((a, b) => b.at.localeCompare(a.at)) : [];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 mb-2">
        <History className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">History</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 italic">No history recorded yet</p>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-2 text-xs py-1 border-l-2 border-border pl-2"
            >
              <span className="shrink-0 text-muted-foreground whitespace-nowrap font-mono text-[10px] mt-0.5">
                {formatDate(entry.at)}
              </span>
              <span className="text-foreground/80 leading-snug">{entry.action}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
