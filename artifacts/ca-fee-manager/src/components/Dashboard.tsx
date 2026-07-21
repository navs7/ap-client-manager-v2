import { useState, useMemo, useEffect, useCallback } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  useFinancialYears, useClients, useUserSettings,
  createFinancialYear, DEFAULT_TAGS,
} from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from './ThemeToggle';
import { FYSelector, getCurrentFYName } from './FYSelector';
import { SettingsMenu } from './SettingsMenu';
import { MetricsCard } from './MetricsCard';
import { ClientSection } from './ClientSection';
import { getTagColor } from './TagSelector';
import { Calculator, LogOut, Search, X, Filter, FileCheck2, ArrowUp } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';

type FilterType = 'all' | 'pending' | 'partial' | 'paid' | 'no_service' | 'itr_filed' | 'itr_not_filed';

interface FilterOption { value: FilterType; label: string; shortLabel: string; }

const STATUS_FILTERS: FilterOption[] = [
  { value: 'all',           label: 'All Clients',          shortLabel: 'All' },
  { value: 'pending',       label: 'Pending / Active',     shortLabel: 'Pending' },
  { value: 'partial',       label: 'Partial Payments',     shortLabel: 'Partial' },
  { value: 'paid',          label: 'Fees Paid',            shortLabel: 'Paid' },
  { value: 'no_service',    label: 'No Service This Year', shortLabel: 'No Service' },
  { value: 'itr_filed',     label: 'ITR Filed',            shortLabel: 'ITR Filed' },
  { value: 'itr_not_filed', label: 'ITR Not Filed',        shortLabel: 'ITR Not Filed' },
];

const QUICK_PILLS: FilterType[] = ['pending', 'partial', 'paid', 'no_service', 'itr_filed', 'itr_not_filed'];

export function Dashboard() {
  const { user } = useAuth();
  const { years, loading: yearsLoading } = useFinancialYears(user?.uid);
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
  const { clients, loading: clientsLoading } = useClients(user?.uid, selectedYearId || undefined);
  const { customTags, waTemplate, waMessages } = useUserSettings(user?.uid);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const allTags = useMemo(() => [...DEFAULT_TAGS, ...customTags], [customTags]);

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
    if (existingId) { setSelectedYearId(existingId); return; }
    try { setSelectedYearId(await createFinancialYear(user!.uid, fyName)); }
    catch { toast.error('Failed to open financial year'); }
  }

  function toggleFilter(value: FilterType) {
    setActiveFilter((prev) => (prev === value ? 'all' : value));
  }

  function toggleTagFilter(tag: string) {
    setTagFilters((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  }

  const filteredClients = useMemo(() => {
    let result = clients;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }
    switch (activeFilter) {
      case 'pending':       result = result.filter((c) => c.status === 'pending');    break;
      case 'partial':       result = result.filter((c) => c.status === 'partial');    break;
      case 'paid':          result = result.filter((c) => c.status === 'paid');       break;
      case 'no_service':    result = result.filter((c) => c.status === 'no_service'); break;
      case 'itr_filed':     result = result.filter((c) => c.itrFiled === true);       break;
      case 'itr_not_filed': result = result.filter((c) => !c.itrFiled);              break;
    }
    if (tagFilters.length > 0) {
      result = result.filter((c) => {
        const ct = c.tags || [];
        return tagFilters.some((t) => ct.includes(t));
      });
    }
    return result;
  }, [clients, searchQuery, activeFilter, tagFilters]);

  const pendingClients   = useMemo(() => filteredClients.filter((c) => c.status === 'pending'),    [filteredClients]);
  const partialClients   = useMemo(() => filteredClients.filter((c) => c.status === 'partial'),    [filteredClients]);
  const paidClients      = useMemo(() => filteredClients.filter((c) => c.status === 'paid'),       [filteredClients]);
  const noServiceClients = useMemo(() => filteredClients.filter((c) => c.status === 'no_service'), [filteredClients]);
  const isItrFilter = activeFilter === 'itr_filed' || activeFilter === 'itr_not_filed';

  const hasAnyFilter = activeFilter !== 'all' || tagFilters.length > 0 || searchQuery.trim() !== '';
  const activeFilterLabel = STATUS_FILTERS.find((o) => o.value === activeFilter)?.label ?? 'All Clients';

  async function handleSignOut() {
    try { await signOut(auth); } catch { toast.error('Failed to sign out'); }
  }

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
              <Button variant="ghost" size="sm" onClick={handleSignOut} data-testid="button-signout">
                <LogOut className="w-4 h-4 mr-2" />Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* FY Selector Bar */}
      <div className="sticky top-16 z-40 bg-background border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2">
            <FYSelector years={years} selectedYearId={selectedYearId} onSelectFY={handleSelectFY} />
            <SettingsMenu uid={user?.uid || ''} fyId={selectedYearId} clients={clients} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {yearsLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading financial years...</div>
        ) : !selectedYearId ? (
          <div className="text-center py-12 text-muted-foreground">Select a financial year from the dropdown above</div>
        ) : (
          <>
            <MetricsCard clients={clients} />

            {/* ── Search + Filter Bar ── */}
            {/* On mobile: only Row 1 (filter + search) is sticky. Pills scroll with content. */}
            {/* On sm+: all 3 rows are sticky. */}

            {/* Sticky section */}
            <div className="sticky top-[125px] z-30 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 border-b border-border">
              <div className="py-2 space-y-2">
                {/* Row 1: filter dropdown + search + clear — always sticky */}
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant={activeFilter !== 'all' ? 'default' : 'outline'}
                        size="sm"
                        className="gap-1.5 h-9 shrink-0"
                        data-testid="button-filter-dropdown"
                      >
                        <Filter className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">
                          {activeFilter === 'all' ? 'Filter' : activeFilterLabel}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuLabel>Status</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {STATUS_FILTERS.map((opt) => (
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
                      {allTags.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Tags</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {allTags.map((tag) => (
                            <DropdownMenuCheckboxItem
                              key={tag}
                              checked={tagFilters.includes(tag)}
                              onCheckedChange={() => toggleTagFilter(tag)}
                              className="gap-2"
                            >
                              <span className={`inline-block w-2 h-2 rounded-full ${getTagColor(tag).bg.split(' ')[0]}`} />
                              {tag}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="search" value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search clients..." className="pl-10 pr-10"
                      data-testid="input-search-clients"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" data-testid="button-clear-search">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {hasAnyFilter && (
                    <Button variant="ghost" size="sm" onClick={() => { setActiveFilter('all'); setTagFilters([]); setSearchQuery(''); }}
                      className="h-9 px-2 text-muted-foreground hover:text-foreground shrink-0" title="Clear all filters">
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* Rows 2 & 3: pills — sticky only on sm+, hidden on mobile inside sticky */}
                <div className="hidden sm:block space-y-2">
                  {/* Row 2: status quick-pills */}
                  <div className="flex items-center flex-wrap gap-1.5">
                    {QUICK_PILLS.map((value) => {
                      const opt = STATUS_FILTERS.find((o) => o.value === value)!;
                      const isActive = activeFilter === value;
                      return (
                        <button
                          key={value}
                          onClick={() => toggleFilter(value)}
                          data-testid={`filter-pill-${value}`}
                          className={`shrink-0 text-xs px-3 py-1 rounded-full border transition-colors font-medium whitespace-nowrap ${
                            isActive
                              ? 'bg-primary text-primary-foreground border-primary'
                              : (value === 'itr_filed' || value === 'itr_not_filed')
                                ? 'text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                                : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground hover:bg-accent/10'
                          }`}
                        >
                          {value === 'itr_filed' && '✓ '}{opt.shortLabel}
                        </button>
                      );
                    })}
                  </div>

                  {/* Row 3: tag filter pills */}
                  {allTags.length > 0 && (
                    <div className="flex items-center flex-wrap gap-1.5">
                      <span className="text-xs text-muted-foreground shrink-0 font-medium">Tags:</span>
                      {allTags.map((tag) => {
                        const isActive = tagFilters.includes(tag);
                        const c = getTagColor(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => toggleTagFilter(tag)}
                            data-testid={`tag-filter-pill-${tag}`}
                            className={`shrink-0 text-xs px-2.5 py-0.5 rounded-full border transition-colors font-medium whitespace-nowrap ${
                              isActive
                                ? `${c.bg} ${c.text} ${c.border}`
                                : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:bg-accent/10'
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                      {tagFilters.length > 0 && (
                        <button onClick={() => setTagFilters([])} className="shrink-0 text-xs text-muted-foreground hover:text-foreground underline">
                          clear
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile-only: pills rows below the sticky bar, scroll with content */}
            <div className="sm:hidden -mx-4 px-4 pt-2 pb-1 border-b border-border space-y-2">
              {/* Row 2: status quick-pills */}
              <div className="flex items-center flex-wrap gap-1.5">
                {QUICK_PILLS.map((value) => {
                  const opt = STATUS_FILTERS.find((o) => o.value === value)!;
                  const isActive = activeFilter === value;
                  return (
                    <button
                      key={value}
                      onClick={() => toggleFilter(value)}
                      data-testid={`filter-pill-mobile-${value}`}
                      className={`shrink-0 text-xs px-3 py-1 rounded-full border transition-colors font-medium whitespace-nowrap ${
                        isActive
                          ? 'bg-primary text-primary-foreground border-primary'
                          : (value === 'itr_filed' || value === 'itr_not_filed')
                            ? 'text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                            : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground hover:bg-accent/10'
                      }`}
                    >
                      {value === 'itr_filed' && '✓ '}{opt.shortLabel}
                    </button>
                  );
                })}
              </div>

              {/* Row 3: tag filter pills */}
              {allTags.length > 0 && (
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className="text-xs text-muted-foreground shrink-0 font-medium">Tags:</span>
                  {allTags.map((tag) => {
                    const isActive = tagFilters.includes(tag);
                    const c = getTagColor(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTagFilter(tag)}
                        data-testid={`tag-filter-pill-mobile-${tag}`}
                        className={`shrink-0 text-xs px-2.5 py-0.5 rounded-full border transition-colors font-medium whitespace-nowrap ${
                          isActive
                            ? `${c.bg} ${c.text} ${c.border}`
                            : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:bg-accent/10'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                  {tagFilters.length > 0 && (
                    <button onClick={() => setTagFilters([])} className="shrink-0 text-xs text-muted-foreground hover:text-foreground underline">
                      clear
                    </button>
                  )}
                </div>
              )}
            </div>

            {clientsLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading clients...</div>
            ) : clients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No clients yet. Use Settings → Add Client or Import from Excel to get started.
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No clients match the current filter.
                <button onClick={() => { setActiveFilter('all'); setTagFilters([]); setSearchQuery(''); }}
                  className="block mx-auto mt-2 text-sm text-primary hover:underline">
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {isItrFilter ? (
                  <ClientSection
                    title={activeFilter === 'itr_filed' ? 'ITR Filed' : 'ITR Not Filed'}
                    clients={filteredClients} uid={user?.uid || ''} fyId={selectedYearId}
                    fyName={years.find((y) => y.id === selectedYearId)?.name ?? ''}
                    type="mixed" allTags={allTags} waTemplate={waTemplate ?? ''}
                  />
                ) : (
                  <>
                    {(() => { const fyName = years.find((y) => y.id === selectedYearId)?.name ?? ''; const waTpl = waTemplate ?? ''; return (<>
                    <ClientSection title="Pending / Active Clients" clients={pendingClients} uid={user?.uid || ''} fyId={selectedYearId} fyName={fyName} type="pending" allTags={allTags} waTemplate={waTpl} />
                    <ClientSection title="Partial Payments"         clients={partialClients}   uid={user?.uid || ''} fyId={selectedYearId} fyName={fyName} type="partial"    allTags={allTags} waTemplate={waTpl} />
                    <ClientSection title="Fees Paid"                clients={paidClients}      uid={user?.uid || ''} fyId={selectedYearId} fyName={fyName} type="paid"       allTags={allTags} waTemplate={waTpl} />
                    <ClientSection title="No Service This Year"     clients={noServiceClients} uid={user?.uid || ''} fyId={selectedYearId} fyName={fyName} type="no_service" allTags={allTags} waTemplate={waTpl} />
                    </>); })()}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {/* Scroll-to-top button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all"
          title="Scroll to top"
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
