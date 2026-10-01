import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { PageHeader, EmptyState } from "@/components/shared/table-kit";
import { StatusBadge } from "@/components/shared/status-badge";
import { SalesTrendChart } from "@/components/dashboard/charts";
import { requireClientPage } from "@/lib/auth/guards";
import { getClientOverview, getSalesSeries } from "@/lib/services/dashboard";
import { db } from "@/lib/db";
import { formatRs, formatNumber, fmtDate, startOfDayUTC, addDays } from "@/lib/format";
import {
  Banknote,
  Receipt,
  Building2,
  KeyRound,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Store,
  CalendarClock,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClientDashboardPage() {
  const user = await requireClientPage();
  const clientId = user.clientId!;

  const [overview, client] = await Promise.all([
    getClientOverview(clientId),
    db.client.findUnique({ where: { id: clientId }, select: { companyName: true, name: true } }),
  ]);

  const restaurantIds = overview.restaurants.map((r) => r.id);
  const series = restaurantIds.length
    ? await getSalesSeries({
        restaurantIds,
        from: addDays(startOfDayUTC(new Date()), -29),
        to: new Date(),
      })
    : [];

  // Expiring license warning banner
  const expiringRestaurants = overview.restaurants.filter(
    (r) => r.licenseStatus === "EXPIRING_SOON"
  );
  const expiredRestaurants = overview.restaurants.filter((r) => r.licenseStatus === "EXPIRED");

  return (
    <>
      <PageHeader
        title={`Welcome back, ${client?.name ?? user.fullName}`}
        description={`${client?.companyName} · ${overview.client.restaurantCount} restaurant${overview.client.restaurantCount === 1 ? "" : "s"} · ${overview.client.activeRestaurantCount} active`}
      />

      {(expiringRestaurants.length > 0 || expiredRestaurants.length > 0) && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 dark:border-amber-500/30 p-4">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-200 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> License attention needed
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-700/90 dark:text-amber-300/90">
            {expiringRestaurants.map((r) => (
              <li key={r.id}>
                <strong>{r.name}</strong> expires in {r.licenseDaysRemaining} day
                {r.licenseDaysRemaining === 1 ? "" : "s"} ({fmtDate(r.licenseExpiresAt)}).
              </li>
            ))}
            {expiredRestaurants.map((r) => (
              <li key={r.id}>
                <strong>{r.name}</strong>&apos;s license has expired — contact support to renew.
              </li>
            ))}
          </ul>
          <Button asChild size="sm" variant="outline" className="mt-3 bg-background">
            <Link href="/client/licenses">View licenses</Link>
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Today's sales" value={formatRs(overview.sales.today)} sub={`${formatNumber(overview.sales.todayOrders)} orders today`} icon={Banknote} tone="positive" />
        <StatCard title="This week" value={formatRs(overview.sales.week)} sub="Last 7 days" icon={TrendingUp} />
        <StatCard title="This month" value={formatRs(overview.sales.month)} sub="Month to date" icon={Receipt} />
        <StatCard
          title="Active licenses"
          value={`${overview.licenses.active}/${overview.restaurants.length}`}
          sub={`${overview.licenses.expiringSoon} expiring soon`}
          icon={KeyRound}
          tone={overview.licenses.expiringSoon > 0 ? "warning" : "default"}
        />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Sales — last 30 days</CardTitle>
          <CardDescription>Across all your restaurants</CardDescription>
        </CardHeader>
        <CardContent>
          {series.length > 0 ? (
            <SalesTrendChart data={series} />
          ) : (
            <EmptyState
              icon={<TrendingUp className="h-6 w-6 text-muted-foreground" />}
              title="No synced sales yet"
              description="Your chart fills in as your POS terminals sync sales to the cloud."
            />
          )}
        </CardContent>
      </Card>

      {/* Restaurant cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Your restaurants</h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/client/restaurants">
              Manage all <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        {overview.restaurants.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={<Store className="h-6 w-6 text-muted-foreground" />}
                title="No restaurants yet"
                description="Your CafeFlow representative sets up restaurants and licenses for your account."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {overview.restaurants.map((r) => (
              <Link key={r.id} href={`/client/restaurants/${r.id}`} className="group">
                <Card className="h-full transition-shadow group-hover:shadow-md">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.city ?? "—"}</p>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-muted/40 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">Today&apos;s sales</p>
                        <p className="text-sm font-bold tabular-nums">{formatRs(r.todaySales)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">Today&apos;s orders</p>
                        <p className="text-sm font-bold tabular-nums">{formatNumber(r.todayOrders)}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <KeyRound className="h-3.5 w-3.5" />
                        {r.licenseStatus === "EXPIRING_SOON" ? "Expiring soon" : r.licenseStatus === "NONE" ? "No license" : r.licenseStatus === "EXPIRED" ? "Expired" : "License active"}
                      </span>
                      {r.licenseExpiresAt && (
                        <span
                          className={`flex items-center gap-1.5 ${
                            r.licenseStatus === "EXPIRING_SOON" || r.licenseStatus === "EXPIRED" ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"
                          }`}
                        >
                          <CalendarClock className="h-3.5 w-3.5" />
                          {r.licenseDaysRemaining} days
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
