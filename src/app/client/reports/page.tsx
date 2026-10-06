import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/shared/stat-card";
import { PageHeader } from "@/components/shared/table-kit";
import { UrlPagination } from "@/components/shared/filter-toolbar";
import { DateRangeFilter, DatePresets } from "@/components/shared/date-range-filter";
import { SalesTrendChart, PaymentMethodChart } from "@/components/dashboard/charts";
import { requireClientPage } from "@/lib/auth/guards";
import { getSalesSeries, getPaymentSplit } from "@/lib/services/dashboard";
import { getTerminalBreakdown, listShifts, getActiveTerminals } from "@/lib/services/shifts";
import { db } from "@/lib/db";
import { formatRs, formatNumber, fmtDate, shiftRef } from "@/lib/format";
import { Banknote, Receipt, MonitorSmartphone, Clock, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 14;

/** Detailed sales report across the owner's restaurants — daily sales,
 *  per-terminal breakdown, per-restaurant comparison and shift summary. */
export default async function ClientReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; page?: string }>;
}) {
  const user = await requireClientPage();

  const restaurants = await db.restaurant.findMany({
    where: { clientId: user.clientId! },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  const restaurantIds = restaurants.map((r) => r.id);
  const nameById = new Map(restaurants.map((r) => [r.id, r.name]));

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  // Default window: last 30 days
  const defaultFrom = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const defaultTo = new Date().toISOString().slice(0, 10);
  const fromStr = sp.from ?? defaultFrom;
  const toStr = sp.to ?? defaultTo;
  const from = new Date(fromStr + "T00:00:00Z");
  const to = new Date(toStr + "T23:59:59Z");

  const [series, paymentSplit, terminals, shifts, perRestaurant, activeTerminals] = await Promise.all([
    restaurantIds.length ? getSalesSeries({ restaurantIds, from, to }) : Promise.resolve([]),
    restaurantIds.length ? getPaymentSplit({ restaurantIds, from, to }) : Promise.resolve([]),
    restaurantIds.length ? getTerminalBreakdown({ restaurantIds, from, to }) : Promise.resolve([]),
    restaurantIds.length
      ? listShifts({ restaurantIds, page, pageSize: PAGE_SIZE, from, to })
      : Promise.resolve({ rows: [], total: 0, sumNet: 0, sumGross: 0, sumOrders: 0, page: 1, pageSize: PAGE_SIZE }),
    restaurantIds.length
      ? db.sale.groupBy({
          by: ["restaurantId"],
          where: { restaurantId: { in: restaurantIds }, status: "COMPLETED", saleDate: { gte: from, lte: to } },
          _sum: { total: true },
          _count: true,
        })
      : Promise.resolve([]),
    getActiveTerminals({ restaurantIds }),
  ]);

  const totalRevenue = series.reduce((a, d) => a + d.total, 0);
  const totalOrders = series.reduce((a, d) => a + d.orders, 0);
  const bestDay = series.reduce<null | { date: string; total: number }>(
    (best, d) => (!best || d.total > best.total ? { date: d.date, total: d.total } : best),
    null
  );

  return (
    <>
      <PageHeader
        title="Reports"
        description={`Detailed sales report for ${fmtDate(from)} – ${fmtDate(to)} across all your restaurants.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Revenue (window)" value={formatRs(totalRevenue)} icon={Banknote} tone="positive" />
        <StatCard title="Sales records (window)" value={formatNumber(totalOrders)} icon={Receipt} />
        <StatCard
          title="Average per day"
          value={formatRs(series.length ? totalRevenue / series.length : 0)}
          icon={TrendingUp}
        />
        <StatCard
          title="Best day"
          value={bestDay ? formatRs(bestDay.total) : formatRs(0)}
          sub={bestDay ? bestDay.date : undefined}
          icon={TrendingUp}
          tone="info"
        />
      </div>

      <Suspense>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <DatePresets />
          <DateRangeFilter />
        </div>
      </Suspense>

      {series.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Daily revenue</CardTitle>
            <CardDescription>All restaurants in the selected window</CardDescription>
          </CardHeader>
          <CardContent>
            <SalesTrendChart data={series} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily sales table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Daily sales</CardTitle>
            <CardDescription>One row per day in the window</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-96">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead className="text-right">Sales records</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...series].reverse().map((d) => (
                    <TableRow key={d.date}>
                      <TableCell className="text-sm">{fmtDate(d.date + "T00:00:00Z")}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{formatNumber(d.orders)}</TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">{formatRs(d.total)}</TableCell>
                    </TableRow>
                  ))}
                  {series.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                        No synced sales in this window.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Per-terminal breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <MonitorSmartphone className="h-5 w-5" /> Sales by POS terminal
            </CardTitle>
            <CardDescription>
              {activeTerminals.length > 0
                ? `${activeTerminals.length} terminal${activeTerminals.length === 1 ? "" : "s"} active in the last 24h`
                : "No terminals active in the last 24h"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Terminal</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Order value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terminals.map((t) => (
                    <TableRow key={t.deviceId ?? "unattributed"}>
                      <TableCell className="text-sm font-medium">{t.deviceName}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{formatNumber(t.salesCount)}</TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">{formatRs(t.salesTotal)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{formatNumber(t.ordersCount)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{formatRs(t.ordersTotal)}</TableCell>
                    </TableRow>
                  ))}
                  {terminals.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                        No terminal-attributed sales yet. New syncs are attributed automatically.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Per-restaurant comparison */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>By restaurant</CardTitle>
            <CardDescription>Revenue in the selected window</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perRestaurant
                  .sort((a, b) => (b._sum.total ?? 0) - (a._sum.total ?? 0))
                  .map((r) => (
                    <TableRow key={r.restaurantId}>
                      <TableCell>
                        <Link href={`/client/restaurants/${r.restaurantId}`} className="text-sm font-medium hover:text-primary">
                          {nameById.get(r.restaurantId) ?? "Unknown"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{formatNumber(r._count)}</TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">{formatRs(r._sum.total ?? 0)}</TableCell>
                    </TableRow>
                  ))}
                {perRestaurant.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                      No synced sales in this window.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Payment methods */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Payment methods</CardTitle>
            <CardDescription>Revenue split in the selected window</CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentMethodChart data={paymentSplit} />
          </CardContent>
        </Card>
      </div>

      {/* Shift summary in the window */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Shifts in this window
          </CardTitle>
          <CardDescription>
            {formatNumber(shifts.total)} shifts · net {formatRs(shifts.sumNet)}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shift</TableHead>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Cashier</TableHead>
                  <TableHead className="text-center">Orders</TableHead>
                  <TableHead className="text-right">Net sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link href={`/client/restaurants/${s.restaurantId}/shifts/${s.id}`} className="text-sm font-medium hover:text-primary">
                        <code>{shiftRef(s.localShiftId, s.openedAt)}</code>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{s.restaurant.name}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{fmtDate(s.openedAt)}</TableCell>
                    <TableCell className="text-sm">{s.cashierName ?? "—"}</TableCell>
                    <TableCell className="text-center text-sm tabular-nums">{s.orderCount ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">{formatRs(s.netSales ?? 0)}</TableCell>
                  </TableRow>
                ))}
                {shifts.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                      No shifts closed in this window.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {shifts.total > PAGE_SIZE && (
        <UrlPagination page={shifts.page} pageSize={shifts.pageSize} total={shifts.total} />
      )}
    </>
  );
}
