import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader, EmptyState } from "@/components/shared/table-kit";
import { SalesTrendChart } from "@/components/dashboard/charts";
import { requireClientPage } from "@/lib/auth/guards";
import { assertRestaurantAccess } from "@/lib/auth/guards";
import { getSalesSeries, getPaymentSplit } from "@/lib/services/dashboard";
import { db } from "@/lib/db";
import { formatRs, formatNumber, fmtDate, fmtDateTime, startOfDayUTC, addDays } from "@/lib/format";
import { licenseEffectiveStatus } from "@/lib/license-key";
import {
  Banknote,
  Receipt,
  TrendingUp,
  Coins,
  BarChart3,
  ChevronRight,
  CloudUpload,
  MonitorSmartphone,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClientRestaurantDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireClientPage();
  const { id } = await params;

  // SECURITY: restaurant must belong to the logged-in client
  const access = await assertRestaurantAccess(user, id);
  if (!access.ok) notFound();
  const restaurant = access.restaurant;

  const [license, devices, series, paymentSplit, recentOrders, lastSync] = await Promise.all([
    db.license.findFirst({
      where: { restaurantId: id, status: { not: "REVOKED" } },
      orderBy: { createdAt: "desc" },
    }),
    db.device.findMany({
      where: { restaurantId: id },
      orderBy: { activatedAt: "desc" },
      select: { id: true, deviceName: true, deviceIdentifier: true, status: true, lastSeenAt: true, activatedAt: true },
    }),
    getSalesSeries({ restaurantIds: [id], from: addDays(startOfDayUTC(new Date()), -29), to: new Date() }),
    getPaymentSplit({ restaurantIds: [id] }),
    db.order.findMany({
      where: { restaurantId: id },
      orderBy: { orderDate: "desc" },
      take: 8,
      select: { id: true, orderNumber: true, orderDate: true, total: true, status: true, paymentMethod: true, _count: { select: { items: true } } },
    }),
    db.syncLog.findFirst({ where: { restaurantId: id }, orderBy: { createdAt: "desc" } }),
  ]);

  const todayStart = startOfDayUTC(new Date());
  const weekStart = addDays(todayStart, -6);
  const monthStart = new Date(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1);
  const [todayAgg, weekAgg, monthAgg] = await Promise.all([
    db.sale.aggregate({ where: { restaurantId: id, status: "COMPLETED", saleDate: { gte: todayStart } }, _sum: { total: true }, _count: true }),
    db.sale.aggregate({ where: { restaurantId: id, status: "COMPLETED", saleDate: { gte: weekStart } }, _sum: { total: true } }),
    db.sale.aggregate({ where: { restaurantId: id, status: "COMPLETED", saleDate: { gte: monthStart } }, _sum: { total: true } }),
  ]);

  const eff = license ? licenseEffectiveStatus(license) : null;
  const totalOrdersCount = await db.sale.count({ where: { restaurantId: id, status: "COMPLETED", saleDate: { gte: monthStart } } });
  const avgOrder = monthAgg._sum.total && totalOrdersCount ? monthAgg._sum.total / totalOrdersCount : 0;

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/client/restaurants" className="hover:text-foreground">My Restaurants</Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate">{restaurant.name}</span>
      </div>

      <PageHeader
        title={restaurant.name}
        description="This restaurant's isolated workspace — sales, orders, license and devices."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/client/restaurants/${id}/sales`}>
                <BarChart3 className="h-4 w-4" /> Sales dashboard
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/client/restaurants/${id}/orders`}>
                <Receipt className="h-4 w-4" /> Orders
              </Link>
            </Button>
          </>
        }
      />

      {lastSync && (
        <div className="rounded-xl border bg-muted/40 px-4 py-3 flex items-center gap-2.5 text-sm">
          <CloudUpload className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">
            Last POS sync <strong className="text-foreground">{fmtDateTime(lastSync.createdAt)}</strong> ·{" "}
            {lastSync.recordsCreated} records uploaded
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Today's sales" value={formatRs(todayAgg._sum.total ?? 0)} sub={`${formatNumber(todayAgg._count)} orders`} icon={Banknote} tone="positive" />
        <StatCard title="This week" value={formatRs(weekAgg._sum.total ?? 0)} icon={TrendingUp} />
        <StatCard title="This month" value={formatRs(monthAgg._sum.total ?? 0)} icon={Receipt} />
        <StatCard title="Average order (month)" value={formatRs(avgOrder)} icon={Coins} tone="info" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Sales — last 30 days</CardTitle>
          <CardDescription>{restaurant.name} only</CardDescription>
        </CardHeader>
        <CardContent>
          {series.length > 0 ? (
            <SalesTrendChart data={series} />
          ) : (
            <EmptyState
              icon={<TrendingUp className="h-6 w-6 text-muted-foreground" />}
              title="No synced sales yet"
              description="This chart fills in as the POS terminal for this restaurant syncs."
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent orders</CardTitle>
                <CardDescription>Latest synced orders from this restaurant</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/client/restaurants/${id}/orders`}>View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center px-6">
                No orders synced yet.
              </p>
            ) : (
              <ul className="divide-y">
                {recentOrders.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/client/restaurants/${id}/orders/${o.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <code className="text-sm font-medium">{o.orderNumber}</code>
                        <p className="text-xs text-muted-foreground">
                          {fmtDateTime(o.orderDate)} · {o._count.items} items
                        </p>
                      </div>
                      <StatusBadge status={o.status} />
                      <span className="text-sm font-semibold tabular-nums">{formatRs(o.total)}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* License + devices */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>License</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              {license ? (
                <>
                  <code className="block text-center font-bold tracking-widest text-base py-2 rounded-lg bg-muted/50">
                    {license.licenseKey}
                  </code>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <StatusBadge status={eff!.effectiveStatus} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expires</span>
                    <span>{fmtDate(license.expiresAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Days remaining</span>
                    <span className={eff!.daysRemaining <= 30 ? "text-amber-600 font-medium" : ""}>
                      {eff!.daysRemaining}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Device limit</span>
                    <span>
                      {devices.filter((d) => d.status === "ACTIVE").length}/{license.maxDevices} active
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-sm py-2">
                  No license issued yet. Contact support to activate this restaurant.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Devices</CardTitle>
              <CardDescription>POS terminals on this restaurant</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {devices.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center px-6">
                  No POS terminal activated yet.
                </p>
              ) : (
                <ul className="divide-y max-h-64 overflow-y-auto">
                  {devices.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                      <MonitorSmartphone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{d.deviceName ?? d.deviceIdentifier}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.lastSeenAt ? `Seen ${fmtDateTime(d.lastSeenAt)}` : "Never seen"}
                        </p>
                      </div>
                      <StatusBadge status={d.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {paymentSplit.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Payment methods</CardTitle>
            <CardDescription>All-time revenue split for {restaurant.name}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            {paymentSplit.map((p) => (
              <div key={p.method} className="rounded-lg border bg-muted/40 px-4 py-3.5">
                <p className="text-xs text-muted-foreground">{p.method.charAt(0) + p.method.slice(1).toLowerCase()}</p>
                <p className="text-lg font-bold tabular-nums mt-1">{formatRs(p.total)}</p>
                <p className="text-xs text-muted-foreground">{formatNumber(p.count)} orders</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
