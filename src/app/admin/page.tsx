import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { PageHeader } from "@/components/shared/table-kit";
import { SalesTrendChart, PaymentMethodChart } from "@/components/dashboard/charts";
import {
  getAdminOverview,
  getAdminSalesTrend,
  getAdminPaymentSplit,
  getTopRestaurants,
} from "@/lib/services/dashboard";
import { formatRs, formatNumber, fmtDate } from "@/lib/format";
import {
  Users,
  Store,
  KeyRound,
  AlertTriangle,
  CalendarClock,
  Banknote,
  TrendingUp,
  ArrowRight,
  Building2,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [overview, trend, paymentSplit, topRestaurants] = await Promise.all([
    getAdminOverview(),
    getAdminSalesTrend(14),
    getAdminPaymentSplit(),
    getTopRestaurants(5),
  ]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Platform-wide snapshot of clients, restaurants, licenses and synced sales."
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
          title="Today's sales"
          value={formatRs(overview.sales.today)}
          sub={`${formatNumber(overview.sales.todayOrders)} orders synced today`}
          icon={Banknote}
          tone="positive"
        />
        <StatCard
          title="This month's sales"
          value={formatRs(overview.sales.month)}
          sub={`${formatNumber(overview.sales.monthOrders)} orders this month`}
          icon={TrendingUp}
        />
        <StatCard
          title="Expiring within 30 days"
          value={formatNumber(overview.licenses.expiringSoon)}
          sub="Review and extend before expiry"
          icon={CalendarClock}
          tone="warning"
        />
        <StatCard
          title="Expired licenses"
          value={formatNumber(overview.licenses.expired)}
          sub="POS terminals may enter grace period"
          icon={AlertTriangle}
          tone={overview.licenses.expired > 0 ? "danger" : "default"}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>Platform revenue — last 14 days</CardTitle>
            <CardDescription>Total synced sales across all restaurants</CardDescription>
          </CardHeader>
          <CardContent>
            <SalesTrendChart data={trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Payment methods</CardTitle>
            <CardDescription>Revenue split this month</CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentMethodChart data={paymentSplit} />
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
                <CardDescription>By synced revenue</CardDescription>
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
                No sales synced yet. Sales appear here once POS terminals start syncing.
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
                      <p className="text-sm font-semibold tabular-nums">{formatRs(r.total)}</p>
                      <p className="text-xs text-muted-foreground">{formatNumber(r.orders)} orders</p>
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
    </>
  );
}
