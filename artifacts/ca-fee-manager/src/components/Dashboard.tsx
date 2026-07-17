import { useState, useMemo, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useFinancialYears, useClients } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from './ThemeToggle';
import { FYSelector } from './FYSelector';
import { MetricsCard } from './MetricsCard';
import { ClientSection } from './ClientSection';
import { ExcelImport } from './ExcelImport';
import { Calculator, LogOut, Search, X } from 'lucide-react';
import { toast } from 'sonner';

export function Dashboard() {
  const { user } = useAuth();
  const { years, loading: yearsLoading } = useFinancialYears(user?.uid);
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
  const { clients, loading: clientsLoading } = useClients(user?.uid, selectedYearId || undefined);
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-select first year if available
  useEffect(() => {
    if (!selectedYearId && years.length > 0) {
      setSelectedYearId(years[0].id);
    }
  }, [years, selectedYearId]);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter((c) => c.name.toLowerCase().includes(query));
  }, [clients, searchQuery]);

  const pendingClients = useMemo(
    () => filteredClients.filter((c) => c.status === 'pending'),
    [filteredClients]
  );
  const paidClients = useMemo(
    () => filteredClients.filter((c) => c.status === 'paid'),
    [filteredClients]
  );
  const noServiceClients = useMemo(
    () => filteredClients.filter((c) => c.status === 'no_service'),
    [filteredClients]
  );

  async function handleSignOut() {
    try {
      await signOut(auth);
    } catch (error) {
      toast.error('Failed to sign out');
    }
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
            <FYSelector
              years={years}
              selectedYearId={selectedYearId}
              onSelectYear={setSelectedYearId}
              uid={user?.uid || ''}
            />
            <ExcelImport uid={user?.uid || ''} fyId={selectedYearId} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {yearsLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading financial years...
          </div>
        ) : years.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              No financial years found. Create one to get started.
            </p>
          </div>
        ) : !selectedYearId ? (
          <div className="text-center py-12 text-muted-foreground">
            Select a financial year to view clients
          </div>
        ) : (
          <>
            {/* Metrics */}
            <MetricsCard clients={clients} />

            {/* Search Bar */}
            <div className="sticky top-[136px] z-30 bg-background py-2 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 border-b border-border">
              <div className="relative max-w-md">
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
            </div>

            {/* Client Sections */}
            {clientsLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                Loading clients...
              </div>
            ) : clients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No clients yet. Import from Excel to get started.
              </div>
            ) : (
              <div className="space-y-8">
                <ClientSection
                  title="Pending / Active Clients"
                  clients={pendingClients}
                  uid={user?.uid || ''}
                  fyId={selectedYearId}
                  type="pending"
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
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
