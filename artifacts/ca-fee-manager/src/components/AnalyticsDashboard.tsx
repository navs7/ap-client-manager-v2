import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'wouter';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  useFinancialYears, useClients, createFinancialYear, DEFAULT_TAGS, useUserSettings,
} from '@/hooks/useFirestore';
import { FYSelector, getCurrentFYName } from './FYSelector';
import { Button } from '@/components/ui/button';
import { getTagColor } from './TagSelector';
import {
  ArrowLeft, Users, Wallet, TrendingUp, BadgePercent,
  CheckCircle2, FileCheck2, XCircle, Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as RTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadialBarChart, RadialBar,
} from 'recharts';
import { toast } from 'sonner';

/* ─────────────────────────────── helpers ─────────────────────────────── */

function formatINR(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
}
function formatINRFull(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n);
}

const STATUS_COLORS = {
  pending:    '#f59e0b',
  partial:    '#f97316',
  paid:       '#22c55e',
  no_service: '#ef4444',
};

const CHART_PALETTE = ['#6366f1','#22c55e','#f59e0b','#ef4444','#f97316','#3b82f6','#a855f7','#ec4899','#14b8a6','#84cc16'];

/* ─────────────────────────── custom tooltip ──────────────────────────── */

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
      {label && <p className="font-medium text-foreground mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill }} className="text-xs">
          {p.name}: <span className="font-semibold">{
            typeof p.value === 'number' && p.value > 500
              ? formatINRFull(p.value)
              : p.value
          }</span>
        </p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-medium" style={{ color: p.payload.fill }}>{p.name}</p>
      <p className="text-xs text-muted-foreground">{p.value} clients ({p.payload.pct}%)</p>
    </div>
  );
}

/* ─────────────────────────── KPI card ────────────────────────────────── */

interface KpiProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
}
function KpiCard({ label, value, sub, icon, accent }: KpiProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/* ─────────────────────────── section wrapper ─────────────────────────── */

function Section({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 sm:p-6 ${className}`}>
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      {children}
    </div>
  );
}

/* ─────────────────────────── main component ─────────────────────────── */

export function AnalyticsDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { years, loading: yearsLoading } = useFinancialYears(user?.uid);
  const SESSION_KEY = 'ca_selected_fy';
  const [selectedYearId, setSelectedYearId] = useState<string | null>(
    () => sessionStorage.getItem(SESSION_KEY),
  );
  const { clients, loading: clientsLoading } = useClients(user?.uid, selectedYearId || undefined);
  const { customTags } = useUserSettings(user?.uid);
  const allTags = useMemo(() => [...DEFAULT_TAGS, ...customTags], [customTags]);

  function persistFY(id: string) {
    sessionStorage.setItem(SESSION_KEY, id);
    setSelectedYearId(id);
  }

  /* auto-select current FY only when nothing is saved in session */
  useEffect(() => {
    if (selectedYearId || yearsLoading || !user) return;
    const currentFY = getCurrentFYName();
    const existing = years.find((y) => y.name === currentFY);
    if (existing) {
      persistFY(existing.id);
    } else {
      createFinancialYear(user.uid, currentFY)
        .then(persistFY)
        .catch(() => toast.error('Failed to initialise current financial year'));
    }
  }, [years, yearsLoading, selectedYearId, user]);

  async function handleSelectFY(fyName: string, existingId: string | null) {
    if (existingId) { persistFY(existingId); return; }
    try { persistFY(await createFinancialYear(user!.uid, fyName)); }
    catch { toast.error('Failed to open financial year'); }
  }

  /* ── derived analytics ── */
  const stats = useMemo(() => {
    const total = clients.length;
    const pending    = clients.filter(c => c.status === 'pending').length;
    const partial    = clients.filter(c => c.status === 'partial').length;
    const paid       = clients.filter(c => c.status === 'paid').length;
    const noService  = clients.filter(c => c.status === 'no_service').length;
    const itrFiled   = clients.filter(c => c.itrFiled).length;
    const itrPending = total - itrFiled;

    const totalQuoted   = clients.reduce((s, c) => s + (c.quotedFees ?? 0) + (c.otherDues ?? 0), 0);
    const totalReceived = clients.reduce((s, c) => s + (c.feesReceived ?? 0), 0);
    const totalPending  = totalQuoted - totalReceived;
    const totalDiscount = clients
      .filter(c => c.paymentType === 'discount')
      .reduce((s, c) => s + ((c.quotedFees ?? 0) + (c.otherDues ?? 0) - (c.feesReceived ?? 0)), 0);
    const collectionRate = totalQuoted > 0 ? Math.round((totalReceived / totalQuoted) * 100) : 0;

    /* status donut */
    const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
    const statusData = [
      { name: 'Pending',    value: pending,   fill: STATUS_COLORS.pending,    pct: pct(pending) },
      { name: 'Partial',    value: partial,   fill: STATUS_COLORS.partial,    pct: pct(partial) },
      { name: 'Paid',       value: paid,      fill: STATUS_COLORS.paid,       pct: pct(paid) },
      { name: 'No Service', value: noService, fill: STATUS_COLORS.no_service, pct: pct(noService) },
    ].filter(d => d.value > 0);

    /* ITR donut */
    const itrData = [
      { name: 'Filed',     value: itrFiled,   fill: '#3b82f6', pct: pct(itrFiled) },
      { name: 'Not Filed', value: itrPending, fill: '#94a3b8', pct: pct(itrPending) },
    ].filter(d => d.value > 0);

    /* fee collection bar (per status) */
    const feeByStatus = [
      { status: 'Pending',    quoted: 0, received: 0, color: STATUS_COLORS.pending },
      { status: 'Partial',    quoted: 0, received: 0, color: STATUS_COLORS.partial },
      { status: 'Paid',       quoted: 0, received: 0, color: STATUS_COLORS.paid },
      { status: 'No Service', quoted: 0, received: 0, color: STATUS_COLORS.no_service },
    ];
    clients.forEach(c => {
      const idx = c.status === 'pending' ? 0 : c.status === 'partial' ? 1 : c.status === 'paid' ? 2 : 3;
      feeByStatus[idx].quoted   += (c.quotedFees ?? 0) + (c.otherDues ?? 0);
      feeByStatus[idx].received += (c.feesReceived ?? 0);
    });

    /* top 8 clients by total fees */
    const topClients = [...clients]
      .map(c => ({
        name: c.name.length > 14 ? c.name.slice(0, 13) + '…' : c.name,
        fullName: c.name,
        total: (c.quotedFees ?? 0) + (c.otherDues ?? 0),
        received: c.feesReceived ?? 0,
        status: c.status,
      }))
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    /* fee bracket distribution */
    const brackets = [
      { label: '≤₹1K',    min: 0,     max: 1000 },
      { label: '₹1K-2K',  min: 1000,  max: 2000 },
      { label: '₹2K-3K',  min: 2000,  max: 3000 },
      { label: '₹3K-5K',  min: 3000,  max: 5000 },
      { label: '₹5K-10K', min: 5000,  max: 10000 },
      { label: '>₹10K',   min: 10000, max: Infinity },
    ].map(b => ({
      label: b.label,
      clients: clients.filter(c => {
        const f = (c.quotedFees ?? 0) + (c.otherDues ?? 0);
        return f >= b.min && f < b.max;
      }).length,
    })).filter(b => b.clients > 0);

    /* tag distribution */
    const tagData = allTags.map(tag => ({
      tag: tag.length > 14 ? tag.slice(0, 13) + '…' : tag,
      fullTag: tag,
      count: clients.filter(c => (c.tags ?? []).includes(tag)).length,
    })).filter(d => d.count > 0).sort((a, b) => b.count - a.count);

    /* payment type breakdown */
    const paymentTypeData = [
      {
        name: 'Full Payment',
        value: clients.filter(c => c.status === 'paid' && c.paymentType !== 'discount' && c.paymentType !== 'partial').length,
        fill: '#22c55e',
      },
      {
        name: 'Partial Payment',
        value: clients.filter(c => c.paymentType === 'partial').length,
        fill: '#f97316',
      },
      {
        name: 'Discount Given',
        value: clients.filter(c => c.paymentType === 'discount').length,
        fill: '#a855f7',
      },
      {
        name: 'No Service',
        value: noService,
        fill: '#ef4444',
      },
      {
        name: 'Pending',
        value: clients.filter(c => c.status === 'pending' && !c.paymentType).length,
        fill: '#f59e0b',
      },
    ].filter(d => d.value > 0).map(d => ({ ...d, pct: pct(d.value) }));

    /* radial collection progress */
    const radialData = [{ name: 'Collected', value: collectionRate, fill: collectionRate >= 75 ? '#22c55e' : collectionRate >= 50 ? '#f59e0b' : '#ef4444' }];

    return {
      total, pending, partial, paid, noService,
      itrFiled, itrPending,
      totalQuoted, totalReceived, totalPending, totalDiscount, collectionRate,
      statusData, itrData, feeByStatus, topClients, brackets, tagData, paymentTypeData, radialData,
    };
  }, [clients, allTags]);

  const loading = yearsLoading || clientsLoading;

  return (
    <div className="min-h-[100dvh] bg-background">

      {/* ── Header ── */}
      <div className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')} title="Back to Dashboard">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold tracking-tight truncate">Analytics Dashboard</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Fee & client insights</p>
              </div>
            </div>
            <FYSelector years={years} selectedYearId={selectedYearId} onSelectFY={handleSelectFY} />
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {loading ? (
          <div className="text-center py-24 text-muted-foreground">Loading data…</div>
        ) : clients.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">No client data for this financial year.</div>
        ) : (
          <>
            {/* ── KPI Row ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard
                label="Total Clients" value={String(stats.total)}
                sub={`${stats.paid} paid · ${stats.pending} pending`}
                icon={<Users className="w-4 h-4" />}
                accent="bg-primary/10 text-primary"
              />
              <KpiCard
                label="Total Billed" value={formatINR(stats.totalQuoted)}
                sub={formatINRFull(stats.totalQuoted)}
                icon={<Wallet className="w-4 h-4" />}
                accent="bg-blue-500/10 text-blue-500"
              />
              <KpiCard
                label="Collected" value={formatINR(stats.totalReceived)}
                sub={`${stats.collectionRate}% collection rate`}
                icon={<TrendingUp className="w-4 h-4" />}
                accent="bg-green-500/10 text-green-500"
              />
              <KpiCard
                label="Outstanding" value={formatINR(stats.totalPending)}
                sub={`Across ${stats.pending + stats.partial} clients`}
                icon={<Clock className="w-4 h-4" />}
                accent="bg-amber-500/10 text-amber-500"
              />
              <KpiCard
                label="ITR Filed" value={String(stats.itrFiled)}
                sub={`${stats.total > 0 ? Math.round((stats.itrFiled / stats.total) * 100) : 0}% of clients`}
                icon={<FileCheck2 className="w-4 h-4" />}
                accent="bg-blue-500/10 text-blue-500"
              />
              <KpiCard
                label="Discounts" value={formatINR(stats.totalDiscount)}
                sub="Total discount given"
                icon={<BadgePercent className="w-4 h-4" />}
                accent="bg-purple-500/10 text-purple-500"
              />
            </div>

            {/* ── Row 1: Status Donut + Fee by Status ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <Section title="Client Status Distribution">
                {stats.statusData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No data</p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={stats.statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                          paddingAngle={3} dataKey="value" nameKey="name">
                          {stats.statusData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Pie>
                        <RTooltip content={<PieTooltip />} />
                        <Legend
                          formatter={(value, entry: any) => (
                            <span className="text-xs text-foreground">{value} ({entry.payload.value})</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Section>

              <Section title="Fee Collection by Status">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.feeByStatus} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="status" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                      <YAxis tickFormatter={formatINR} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} width={48} />
                      <RTooltip content={<CustomTooltip />} />
                      <Bar dataKey="quoted" name="Billed" fill="#6366f1" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="received" name="Collected" fill="#22c55e" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            </div>

            {/* ── Row 2: ITR Donut + Collection Gauge + Payment Types ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              <Section title="ITR Filing Status">
                {stats.itrData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No data</p>
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={stats.itrData} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                          paddingAngle={3} dataKey="value" nameKey="name">
                          {stats.itrData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Pie>
                        <RTooltip content={<PieTooltip />} />
                        <Legend
                          formatter={(value, entry: any) => (
                            <span className="text-xs text-foreground">{value} ({entry.payload.value})</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Section>

              <Section title="Collection Rate">
                <div className="h-56 flex flex-col items-center justify-center gap-4">
                  <div className="relative w-36 h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%"
                        startAngle={90} endAngle={-270} data={stats.radialData}>
                        <RadialBar background dataKey="value" cornerRadius={8} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-foreground">{stats.collectionRate}%</span>
                      <span className="text-xs text-muted-foreground">collected</span>
                    </div>
                  </div>
                  <div className="text-center space-y-0.5">
                    <p className="text-xs text-muted-foreground">
                      {formatINRFull(stats.totalReceived)} of {formatINRFull(stats.totalQuoted)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatINRFull(stats.totalPending)} still outstanding
                    </p>
                  </div>
                </div>
              </Section>

              <Section title="Payment Type Breakdown">
                {stats.paymentTypeData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No data</p>
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={stats.paymentTypeData} cx="50%" cy="50%" innerRadius={45} outerRadius={68}
                          paddingAngle={3} dataKey="value" nameKey="name">
                          {stats.paymentTypeData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Pie>
                        <RTooltip content={<PieTooltip />} />
                        <Legend
                          formatter={(value, entry: any) => (
                            <span className="text-xs text-foreground">{value} ({entry.payload.value})</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Section>
            </div>

            {/* ── Row 3: Top Clients ── */}
            {stats.topClients.length > 0 && (
              <Section title="Top Clients by Billed Amount">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.topClients} layout="vertical"
                      margin={{ top: 0, right: 24, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                      <XAxis type="number" tickFormatter={formatINR}
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                      <YAxis type="category" dataKey="name" width={100}
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                      <RTooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" name="Billed" radius={[0, 3, 3, 0]}>
                        {stats.topClients.map((_, i) => (
                          <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                        ))}
                      </Bar>
                      <Bar dataKey="received" name="Collected" fill="#22c55e" opacity={0.7} radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            )}

            {/* ── Row 4: Fee Brackets + Tag Distribution ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {stats.brackets.length > 0 && (
                <Section title="Clients by Fee Bracket">
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.brackets} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} width={30} />
                        <RTooltip content={<CustomTooltip />} />
                        <Bar dataKey="clients" name="Clients" radius={[4, 4, 0, 0]}>
                          {stats.brackets.map((_, i) => (
                            <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Section>
              )}

              {stats.tagData.length > 0 && (
                <Section title="Clients by Tag">
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.tagData} layout="vertical"
                        margin={{ top: 0, right: 24, left: 4, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                        <XAxis type="number" allowDecimals={false}
                          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                        <YAxis type="category" dataKey="tag" width={90}
                          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                        <RTooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" name="Clients" radius={[0, 3, 3, 0]}>
                          {stats.tagData.map((_, i) => (
                            <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Section>
              )}
            </div>

            {/* ── Row 5: Detailed fee summary table ── */}
            <Section title="Fee Summary by Status">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                      <th className="text-right py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Clients</th>
                      <th className="text-right py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Billed</th>
                      <th className="text-right py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Collected</th>
                      <th className="text-right py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.feeByStatus.map((row) => {
                      const outstanding = row.quoted - row.received;
                      const clientCount = clients.filter(c => {
                        const statusMap: Record<string, string> = {
                          'Pending': 'pending', 'Partial': 'partial',
                          'Paid': 'paid', 'No Service': 'no_service',
                        };
                        return c.status === statusMap[row.status];
                      }).length;
                      return (
                        <tr key={row.status} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-3 pr-4">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: row.color }} />
                              <span className="font-medium text-foreground">{row.status}</span>
                            </span>
                          </td>
                          <td className="text-right py-3 pr-4 text-muted-foreground">{clientCount}</td>
                          <td className="text-right py-3 pr-4 font-mono text-foreground">{formatINRFull(row.quoted)}</td>
                          <td className="text-right py-3 pr-4 font-mono text-green-600 dark:text-green-400">{formatINRFull(row.received)}</td>
                          <td className="text-right py-3 font-mono text-amber-600 dark:text-amber-400">{formatINRFull(outstanding)}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-muted/20">
                      <td className="py-3 pr-4 font-semibold text-foreground">Total</td>
                      <td className="text-right py-3 pr-4 font-semibold text-foreground">{stats.total}</td>
                      <td className="text-right py-3 pr-4 font-mono font-semibold text-foreground">{formatINRFull(stats.totalQuoted)}</td>
                      <td className="text-right py-3 pr-4 font-mono font-semibold text-green-600 dark:text-green-400">{formatINRFull(stats.totalReceived)}</td>
                      <td className="text-right py-3 font-mono font-semibold text-amber-600 dark:text-amber-400">{formatINRFull(stats.totalPending)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>

          </>
        )}
      </div>
    </div>
  );
}
