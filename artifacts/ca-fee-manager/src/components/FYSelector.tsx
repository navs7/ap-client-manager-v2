import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FinancialYear } from '@/hooks/useFirestore';

interface FYSelectorProps {
  years: FinancialYear[];
  selectedYearId: string | null;
  onSelectYear: (yearId: string) => void;
}

export function FYSelector({ years, selectedYearId, onSelectYear }: FYSelectorProps) {
  return (
    <div className="min-w-[200px] w-full sm:w-auto sm:min-w-[240px]">
      <Select value={selectedYearId || undefined} onValueChange={onSelectYear}>
        <SelectTrigger data-testid="select-fy">
          <SelectValue placeholder="Select Financial Year" />
        </SelectTrigger>
        <SelectContent>
          {years.map((year) => (
            <SelectItem key={year.id} value={year.id}>
              {year.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
