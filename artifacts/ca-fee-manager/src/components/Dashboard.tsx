import { useState, useMemo, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useFinancialYears, useClients, createFinancialYear } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from './ThemeToggle';
import { FYSelector, getCurrentFYName } from './FYSelector';
import { SettingsMenu } from './SettingsMenu';
import { MetricsCard } from './MetricsCard';
import { ClientSection } from './ClientSection';
import { Calculator, LogOut, Search, X, Filter, FileCheck2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type FilterType = 'all' | 'pending' | 'partial' | 'paid' | 'no_service' | 'itr_filed' | 'itr_not_filed';

interface FilterOption {
  value: FilterType;
  label: string;
  shortLabel: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { value: 'all',          label: 'All Clients',          shortLabel: 'All' },
  { value: 'pending',      label: 'Pending / Active',     shortLabel: 'Pending' },
  { value: 'partial',      label: 'Partial Payments',     shortLabel: 'Partial' },
  { value: 'paid',         label: 'Fees Paid',            shortLabel: 'Paid' },
  { value: 'no_service',   label: 'No Service This Year', shortLabel: 'No Service' },
  { value: 'itr_filed',    label: 'ITR Filed',            shortLabel: 'ITR Filed' },
  { value: 'itr_not_filed',label: 'ITR Not Filed',        shortLabel: 'ITR Not Filed' },
];

// Pills shown directly outside the filter button for quick access
const QUICK_PILL_VALUES: FilterType[] = ['pending', 'partial', 'paid', 'no_service', 'itr_filed', 'itr_not_filed'];

export function Dashboard() {
  const { user } = useAuth();
  const { years, loading: yearsLoading } = useFinancialYears(user?.uid);
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
  const { clients, loading: clientsLoading } = useClients(user?.uid, selectedYearId || undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Auto-select current FY once years have loaded; create it in Firestore if missing.
  useEffect(() => {
    if (selectedYearId || yearsLoading || !user) return;
    const currentFY = getCurrentFYName();
    const existing = years.find((y) => y.name === currentFY);
    if (existing) {
      setSelectedYearId(existing.id);
    } else {
      createFinancialYear(user.uid, currentFY)
        .then(setSelectedYearId)
        .catch(() => toast.error('Failed to initialise current financial year'));
    }
  }, [years, yearsLoading, selectedYearId, user]);

  async function handleSelectFY(fyName: string, existingId: string | null) {
    if (existingId) {
      setSelectedYearId(existingId);
    } else {
      try {
        const newId = await createFinancialYear(user!.uid, fyName);
        setSelectedYearId(newId);
      } catch {
        toast.error('Failed to open financial year');
      }
    }
  }

  function toggleFilter(value: FilterType) {
    setActiveFilter((prev) => (prev === value ? 'all' : value));
  }

  const filteredClients = useMemo(() => {
    let result = clients;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(query));
    }
    switch (activeFilter) {
      case 'pending':      return result.filter((c) => c.status === 'pending');
      case 'partial':      return result.filter((c) => c.status === 'partial');
      case 'paid':         return result.filter((c) => c.status === 'paid');
      case 'no_service':   return result.filter((c) => c.status === 'no_service');
      case 'itr_filed':    return result.filter((c) => c.itrFiled === true);
      case 'itr_not_filed':return result.filter((c) => !c.itrFiled);
      default:             return result;
    }
  }, [clients, searchQuery, activeFilter]);

  const pendingClients  = useMemo(() => filteredClients.filter((c) => c.status === 'pending'),    [filteredClients]);
  const partialClients  = useMemo(() => filteredClients.filter((c) => c.status === 'partial'),    [filteredClients]);
  const paidClients     = useMemo(() => filteredClients.filter((c) => c.status === 'paid'),       [filteredClients]);
  const noServiceClients= useMemo(() => filteredClients.filter((c) => c.status === 'no_service'), [filteredClients]);

  // For ITR filters, show a flat mixed list
  const isItrFilter = activeFilter === 'itr_filed' || activeFilter === 'itr_not_filed';

  async function handleSignOut() {
    try {
      await signOut(auth);
    } catch {
      toast.error('Failed to sign out');
    }
  }

  const activeFilterLabel = FILTER_OPTIONS.find((o) => o.value === activeFilter)?.label ?? 'All Clients';

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 bg-card border-b border-card-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">Client Fee Manager</h1>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                data-testid="button-signout"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* FY Selector Bar */}
      <div className="sticky top-16 z-40 bg-background border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2">
            <FYSelector
              years={years}
              selectedYearId={selectedYearId}
              onSelectFY={handleSelectFY}
            />
            <SettingsMenu
              uid={user?.uid || ''}
              fyId={selectedYearId}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {yearsLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading financial years...
          </div>
        ) : !selectedYearId ? (
          <div className="text-center py-12 text-muted-foreground">
            Select a financial year from the dropdown above
          </div>
        ) : (
          <>
            <MetricsCard clients={clients} />

            {/* Search + Filter Bar */}
            <div className="sticky top-[125px] z-30 bg-background py-2 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 border-b border-border">
              {/* Row 1: search + filter dropdown */}
              <div className="flex items-center gap-2">
                {/* Filter dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={activeFilter !== 'all' ? 'default' : 'outline'}
                      size="sm"
                      className={`gap-1.5 h-9 shrink-0 ${activeFilter !== 'all' ? 'bg-primary text-primary-foreground' : ''}`}
                      data-testid="button-filter-dropdown"
                    >
                      <Filter className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">
                        {activeFilter === 'all' ? 'Filter' : activeFilterLabel}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52">
                    <DropdownMenuLabel>Filter Clients</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {FILTER_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => setActiveFilter(opt.value)}
                        className={`gap-2 ${activeFilter === opt.value ? 'bg-accent text-accent-foreground font-medium' : ''}`}
                        data-testid={`filter-option-${opt.value}`}
                      >
                        {opt.value === 'itr_filed' && <FileCheck2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                        {opt.label}
                        {activeFilter === opt.value && <span className="ml-auto text-xs">✓</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Search input */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search clients..."
                    className="pl-10 pr-10"
                    data-testid="input-search-clients"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      data-testid="button-clear-search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Clear filter (visible when active) */}
                {activeFilter !== 'all' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveFilter('all')}
                    className="h-9 px-2 text-muted-foreground hover:text-foreground shrink-0"
                    title="Clear filter"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Row 2: quick-access pills */}
              <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5 no-scrollbar">
                {QUICK_PILL_VALUES.map((value) => {
                  const opt = FILTER_OPTIONS.find((o) => o.value === value)!;
                  const isActive = activeFilter === value;
                  return (
                    <button
                      key={value}
                      onClick={() => toggleFilter(value)}
                      data-testid={`filter-pill-${value}`}
                      className={`shrink-0 text-xs px-3 py-1 rounded-full border transition-colors font-medium whitespace-nowrap ${
                        isActive
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground hover:bg-accent/10'
                      } ${value === 'itr_filed' || value === 'itr_not_filed' ? (isActive ? '' : 'text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:border-blue-400') : ''}`}
                    >
                      {value === 'itr_filed' && '✓ '}{opt.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            {clientsLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                Loading clients...
              </div>
            ) : clients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No clients yet. Use Settings → Add Client or Import from Excel to get started.
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No clients match the current filter.
                <button
                  onClick={() => { setActiveFilter('all'); setSearchQuery(''); }}
                  className="block mx-auto mt-2 text-sm text-primary hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {isItrFilter ? (
                  /* Flat mixed list for ITR filters */
                  <ClientSection
                    title={activeFilter === 'itr_filed' ? 'ITR Filed' : 'ITR Not Filed'}
                    clients={filteredClients}
                    uid={user?.uid || ''}
                    fyId={selectedYearId}
                    type="mixed"
                  />
                ) : (
                  /* Sectioned view */
                  <>
                    <ClientSection
                      title="Pending / Active Clients"
                      clients={pendingClients}
                      uid={user?.uid || ''}
                      fyId={selectedYearId}
                      type="pending"
                    />
                    <ClientSection
                      title="Partial Payments"
                      clients={partialClients}
                      uid={user?.uid || ''}
                      fyId={selectedYearId}
                      type="partial"
                    />
                    <ClientSection
                      title="Fees Paid"
                      clients={paidClients}
                      uid={user?.uid || ''}
                      fyId={selectedYearId}
                      type="paid"
                    />
                    <ClientSection
                      title="No Service This Year"
                      clients={noServiceClients}
                      uid={user?.uid || ''}
                      fyId={selectedYearId}
                      type="no_service"
                    />
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
