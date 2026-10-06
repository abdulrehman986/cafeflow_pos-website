import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge, PaymentBadge } from "@/components/shared/status-badge";
import { PageHeader, EmptyState } from "@/components/shared/table-kit";
import { RestaurantTabs } from "@/components/client/restaurant-tabs";
import { UrlPagination } from "@/components/shared/filter-toolbar";
import { DateRangeFilter, DatePresets } from "@/components/shared/date-range-filter";
import { SalesTrendChart } from "@/components/dashboard/charts";
import { requireClientPage, assertRestaurantAccess } from "@/lib/auth/guards";
import { getSalesSeries, listSales, getPaymentSplit } from "@/lib/services/dashboard";
import { getTerminalBreakdown } from "@/lib/services/shifts";
import { formatRs, formatNumber, fmtDate, fmtTime, startOfDayUTC, addDays } from "@/lib/format";
import { Banknote, Receipt, Coins, TrendingUp, MonitorSmartphone } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export default async function ClientRestaurantSalesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; paymentMethod?: string; page?: string }>;
}) {
  const user = await requireClientPage();
  const { id } = await params;

  // SECURITY: restaurant must belong to the logged-in client
  const access = await assertRestaurantAccess(user, id);
  if (!access.ok) notFound();
  const restaurant = access.restaurant;

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const from = sp.from ? new Date(sp.from + "T00:00:00Z") : undefined;
  const to = sp.to ? new Date(sp.to + "T23:59:59Z") : undefined;

  const [result, series, paymentSplit, terminals] = await Promise.all([
    listSales({ restaurantIds: [id], page, pageSize: PAGE_SIZE, from, to, paymentMethod: sp.paymentMethod }),
    getSalesSeries({ restaurantIds: [id], from: from ?? addDays(startOfDayUTC(new Date()), -29), to: to ?? new Date() }),
    getPaymentSplit({ restaurantIds: [id], from, to }),
    getTerminalBreakdown({ restaurantIds: [id], from: from ?? addDays(startOfDayUTC(new Date()), -29), to: to ?? new Date() }),
  ]);

  const avg = result.total > 0 ? result.sum / result.total : 0;

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/client/restaurants" className="hover:text-foreground">My Restaurants</Link>
        <span>/</span>
        <Link href={`/client/restaurants/${id}`} className="hover:text-foreground">{restaurant.name}</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Sales</span>
      </div>

      <RestaurantTabs restaurantId={id} active="sales" />

      <PageHeader
        title={`Sales · ${restaurant.name}`}
        description="Daily, weekly and monthly synced revenue with payment breakdown."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Filtered revenue" value={formatRs(result.sum)} icon={Banknote} tone="positive" />
        <StatCard title="Transactions" value={formatNumber(result.total)} icon={Receipt} />
        <StatCard title="Average sale" value={formatRs(avg)} icon={Coins} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Sales trend</CardTitle>
          <CardDescription>
            {sp.from || sp.to ? "Selected date range" : "Last 30 days"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {series.length > 0 ? (
            <SalesTrendChart data={series} />
          ) : (
            <EmptyState
              icon={<TrendingUp className="h-6 w-6 text-muted-foreground" />}
              title="No sales in this range"
              description="Adjust the date range, or wait for the POS to sync."
            />
          )}
        </CardContent>
      </Card>

      <Suspense>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <DatePresets />
          <DateRangeFilter />
        </div>
      </Suspense>

      {paymentSplit.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-4">
          {paymentSplit.map((p) => (
            <Card key={p.method}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{p.method.charAt(0) + p.method.slice(1).toLowerCase()}</p>
                <p className="text-base font-bold tabular-nums mt-1">{formatRs(p.total)}</p>
                <p className="text-xs text-muted-foreground">{formatNumber(p.count)} orders</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily sales summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Daily sales summary</CardTitle>
            <CardDescription>Revenue and transactions per day</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-96">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
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
                        No sales in this range.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Sales by POS terminal */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <MonitorSmartphone className="h-5 w-5" /> Sales by POS terminal
            </CardTitle>
            <CardDescription>Attribution starts with syncs after terminal tracking went live</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Terminal</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {terminals.map((t) => (
                  <TableRow key={t.deviceId ?? "unattributed"}>
                    <TableCell className="text-sm font-medium">{t.deviceName}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{formatNumber(t.salesCount)}</TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">{formatRs(t.salesTotal)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{formatNumber(t.ordersCount)}</TableCell>
                  </TableRow>
                ))}
                {terminals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                      No terminal-attributed sales yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-0 pt-5">
          <CardTitle>Transactions</CardTitle>
          <CardDescription>Individual synced sales records</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {result.rows.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6 text-muted-foreground" />}
              title="No sales found"
              description="No synced sales match the current filters."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sale #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell><code className="text-sm">{s.saleNumber ?? s.localSaleId.slice(0, 8)}</code></TableCell>
                      <TableCell className="text-sm">{fmtDate(s.saleDate)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtTime(s.saleDate)}</TableCell>
                      <TableCell><PaymentBadge method={s.paymentMethod} /></TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">{formatRs(s.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {result.total > 0 && <UrlPagination page={result.page} pageSize={result.pageSize} total={result.total} />}
    </>
  );
}
