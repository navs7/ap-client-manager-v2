import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Client } from '@/hooks/useFirestore';
import { IndianRupee, Users, CheckCircle2, Clock, FileCheck2, BadgePercent } from 'lucide-react';

interface MetricsCardProps {
  clients: Client[];
}

export function MetricsCard({ clients }: MetricsCardProps) {
  const metrics = useMemo(() => {
    const totalClients = clients.length;
    const paidCount = clients.filter((c) => c.status === 'paid').length;
    const pendingCount = clients.filter((c) => c.status === 'pending').length;
    const itrFiledCount = clients.filter((c) => c.itrFiled === true).length;

    const totalFees = (c: Client) => (c.quotedFees || 0) + (c.otherDues || 0);

    const totalQuoted = clients.reduce((sum, c) => sum + totalFees(c), 0);

    const totalReceived = clients
      .filter((c) => c.status === 'paid' || c.status === 'partial')
      .reduce((sum, c) => sum + (c.feesReceived || 0), 0);

    const pending = clients
      .filter((c) => c.status !== 'paid' && c.status !== 'no_service')
      .reduce((sum, c) => sum + Math.max(0, totalFees(c) - (c.feesReceived || 0)), 0);

    // Discount = clients who received a discount (paymentType === 'discount')
    // Discount amount = quoted total − fees received
    const totalDiscount = clients
      .filter((c) => c.paymentType === 'discount')
      .reduce((sum, c) => sum + Math.max(0, totalFees(c) - (c.feesReceived || 0)), 0);

    return { totalClients, paidCount, pendingCount, itrFiledCount, totalQuoted, totalReceived, pending, totalDiscount };
  }, [clients]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  return (
    <Card className="border-card-border">
      <CardContent className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-6">
          {/* Row 1 */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Users className="w-4 h-4" />
              <span>Total Clients</span>
            </div>
            <div className="text-2xl font-bold tracking-tight" data-testid="metric-total-clients">
              {metrics.totalClients}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Paid</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-accent" data-testid="metric-paid-count">
              {metrics.paidCount}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="w-4 h-4" />
              <span>Pending</span>
            </div>
            <div className="text-2xl font-bold tracking-tight" data-testid="metric-pending-count">
              {metrics.pendingCount}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <FileCheck2 className="w-4 h-4 text-blue-500" />
              <span>ITR Filed</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400" data-testid="metric-itr-filed">
              {metrics.itrFiledCount}
            </div>
          </div>

          {/* Row 2 */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <IndianRupee className="w-4 h-4" />
              <span>Total Fees</span>
            </div>
            <div className="text-2xl font-bold tracking-tight font-mono" data-testid="metric-quoted-fees">
              {fmt(metrics.totalQuoted)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <IndianRupee className="w-4 h-4" />
              <span>Received</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-accent font-mono" data-testid="metric-received-fees">
              {fmt(metrics.totalReceived)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <IndianRupee className="w-4 h-4" />
              <span>Pending Amount</span>
            </div>
            <div className="text-2xl font-bold tracking-tight font-mono" data-testid="metric-pending-amount">
              {fmt(metrics.pending)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <BadgePercent className="w-4 h-4 text-orange-500" />
              <span>Total Discount</span>
            </div>
            <div className="text-2xl font-bold tracking-tight font-mono text-orange-600 dark:text-orange-400" data-testid="metric-total-discount">
              {fmt(metrics.totalDiscount)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
