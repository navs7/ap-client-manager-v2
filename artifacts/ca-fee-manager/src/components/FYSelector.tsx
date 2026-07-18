import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FinancialYear } from '@/hooks/useFirestore';

/** Indian FY runs Apr–Mar. Returns the start calendar year of the current FY. */
function currentFYStartYear(): number {
  const today = new Date();
  const month = today.getMonth() + 1; // 1-based
  const year = today.getFullYear();
  return month >= 4 ? year : year - 1;
}

/** Returns the current FY label, e.g. "2026-2027". */
export function getCurrentFYName(): string {
  const s = currentFYStartYear();
  return `${s}-${s + 1}`;
}

/** Generate FY labels from 2000-2001 up to the upcoming FY, newest first. */
function generateFYOptions(): string[] {
  const upcomingFYStart = currentFYStartYear() + 1;
  const options: string[] = [];
  for (let y = upcomingFYStart; y >= 2000; y--) {
    options.push(`${y}-${y + 1}`);
  }
  return options;
}

const ALL_FY_OPTIONS = generateFYOptions();

interface FYSelectorProps {
  years: FinancialYear[];
  selectedYearId: string | null;
  /** Called with the chosen FY label and its Firestore ID (null if it doesn't exist yet). */
  onSelectFY: (fyName: string, existingId: string | null) => void;
}

export function FYSelector({ years, selectedYearId, onSelectFY }: FYSelectorProps) {
  const selectedName = years.find((y) => y.id === selectedYearId)?.name;

  function handleChange(name: string) {
    const existing = years.find((y) => y.name === name);
    onSelectFY(name, existing?.id ?? null);
  }

  return (
    <Select value={selectedName ?? undefined} onValueChange={handleChange}>
      <SelectTrigger className="w-[148px]" data-testid="select-fy">
        <SelectValue placeholder="Select FY" />
      </SelectTrigger>
      <SelectContent className="max-h-72 overflow-y-auto">
        {ALL_FY_OPTIONS.map((fy) => (
          <SelectItem key={fy} value={fy}>
            {fy}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
