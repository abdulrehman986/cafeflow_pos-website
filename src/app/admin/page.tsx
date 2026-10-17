import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { PageHeader } from "@/components/shared/table-kit";
import { OrdersTrendChart, PaymentMethodOrdersChart } from "@/components/dashboard/charts";
import {
  getAdminOverview,
  getAdminOrderTrend,
  getAdminPaymentOrdersSplit,
  getTopRestaurants,
  getPosSyncOverview,
  getAdminTerminalActivity,
} from "@/lib/services/dashboard";
import { formatNumber, fmtDate, fmtDateTime } from "@/lib/format";
import {
  Users,
  Store,
  KeyRound,
  AlertTriangle,
  Receipt,
  TrendingUp,
  ArrowRight,
  Building2,
  Clock,
  Wallet,
  MonitorSmartphone,
  CalendarClock,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [overview, trend, paymentSplit, topRestaurants, posSync, terminalActivity] = await Promise.all([
    getAdminOverview(),
    getAdminOrderTrend(14),
    getAdminPaymentOrdersSplit(),
    getTopRestaurants(5),
    getPosSyncOverview(),
    getAdminTerminalActivity(),
  ]);

  // Average orders/day this month — day-of-month divisor keeps it live.
  const dayOfMonth = new Date().getUTCDate();
  const avgOrdersPerDay = overview.sales.monthOrders / dayOfMonth;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Platform-wide snapshot of clients, restaurants, licenses and synced order activity. Client revenue is never shown here."
      />

      {/* Key stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Active clients"
          value={formatNumber(overview.clients.active)}
          sub={`${overview.clients.total} total · ${overview.clients.suspended} suspended`}
          icon={Users}
          tone="positive"
        />
        <StatCard
          title="Restaurants"
          value={formatNumber(overview.restaurants.total)}
          sub={`${overview.restaurants.active} active locations`}
          icon={Store}
        />
        <StatCard
          title="Active licenses"
          value={formatNumber(overview.licenses.active)}
          sub={`${overview.licenses.total} issued · ${overview.licenses.pending} pending`}
          icon={KeyRound}
          tone="info"
        />
        <StatCard
          title="Expiring soon"
          value={formatNumber(overview.licenses.expiringSoon)}
          sub={`${overview.licenses.expired} expired · ${overview.licenses.suspended} suspended`}
          icon={AlertTriangle}
          tone={overview.licenses.expiringSoon > 0 ? "warning" : "default"}
        />
        <StatCard
          title="Orders today"
          value={formatNumber(overview.sales.todayOrders)}
          sub="synced from POS terminals today"
          icon={Receipt}
          tone="positive"
        />
        <StatCard
          title="Orders this month"
          value={formatNumber(overview.sales.monthOrders)}
          sub={`${avgOrdersPerDay.toFixed(1)} avg per day this month`}
          icon={TrendingUp}
        />
        <StatCard
          title="Avg orders / day (month)"
          value={avgOrdersPerDay.toFixed(1)}
          sub="Across all restaurants this month"
          icon={CalendarClock}
          tone="info"
        />
        <StatCard
          title="Expired licenses"
          value={formatNumber(overview.licenses.expired)}
          sub={`${formatNumber(overview.licenses.expiringSoon)} expiring within 30 days`}
          icon={AlertTriangle}
          tone={overview.licenses.expired > 0 ? "danger" : "default"}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>Platform orders — last 14 days</CardTitle>
            <CardDescription>Order volume synced from all restaurants</CardDescription>
          </CardHeader>
          <CardContent>
            <OrdersTrendChart data={trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Payment methods</CardTitle>
            <CardDescription>Order split this month</CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentMethodOrdersChart data={paymentSplit} />
          </CardContent>
        </Card>
      </div>

      {/* Top restaurants + quick actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Top restaurants this month</CardTitle>
                <CardDescription>By synced order volume</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/restaurants">
                  All restaurants <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {topRestaurants.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No orders synced yet. Orders appear here once POS terminals start syncing.
              </p>
            ) : (
              <ul className="divide-y">
                {topRestaurants.map((r, i) => (
                  <li key={r.name + i} className="flex items-center gap-4 py-3">
                    <span className="text-sm font-semibold text-muted-foreground w-6 tabular-nums">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.client}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{formatNumber(r.orders)}</p>
                      <p className="text-xs text-muted-foreground">orders this month</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Common admin tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {[
              { href: "/admin/clients", label: "Add a new client", icon: Users },
              { href: "/admin/restaurants", label: "Create a restaurant", icon: Store },
              { href: "/admin/licenses", label: "Generate a license", icon: KeyRound },
              { href: "/admin/devices", label: "Review devices", icon: Building2 },
            ].map((a) => (
              <Button
                key={a.href + a.label}
                asChild
                variant="outline"
                className="w-full justify-start h-11"
              >
                <Link href={a.href}>
                  <a.icon className="h-4 w-4" /> {a.label}
                </Link>
              </Button>
            ))}
            <div className="pt-2">
              <Badge variant="outline" className="text-xs font-normal">
                Server time: {fmtDate(new Date())}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* POS terminal sync — aggregate activity, no per-record detail */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Active POS terminals (24h)"
          value={formatNumber(terminalActivity.activeTerminals)}
          sub={`${formatNumber(terminalActivity.totalTerminals)} active licenses · 24h window`}
          icon={MonitorSmartphone}
          tone={terminalActivity.activeTerminals > 0 ? "positive" : "warning"}
        />
        <StatCard
          title="Shifts synced (24h)"
          value={formatNumber(terminalActivity.shifts24h)}
          sub={posSync.lastSyncedAt ? `Last POS upload ${fmtDateTime(posSync.lastSyncedAt)}` : "Waiting for the first POS sync"}
          icon={Clock}
          tone="info"
        />
        <StatCard
          title="Expenses synced (24h)"
          value={formatNumber(terminalActivity.expenses24h)}
          sub={`${formatNumber(posSync.expenses)} total recorded`}
          icon={Wallet}
        />
        <StatCard
          title="Shifts synced (total)"
          value={formatNumber(posSync.shifts)}
          sub="Closed-shift reconciliations uploaded"
          icon={Receipt}
        />
      </div>
    </>
  );
}
