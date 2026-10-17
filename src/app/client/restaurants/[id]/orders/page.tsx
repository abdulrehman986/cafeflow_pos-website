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
import { requireClientPage, assertRestaurantAccess } from "@/lib/auth/guards";
import { listOrders } from "@/lib/services/dashboard";
import { formatRs, formatNumber, fmtDate, fmtTime, startOfDayUTC } from "@/lib/format";
import { Receipt, Banknote, ChevronRight, CalendarClock } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export default async function ClientRestaurantOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; page?: string }>;
}) {
  const user = await requireClientPage();
  const { id } = await params;

  // SECURITY: restaurant must belong to the logged-in client
  const access = await assertRestaurantAccess(user, id);
  if (!access.ok) notFound();
  const restaurant = access.restaurant;

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  let from = sp.from ? new Date(sp.from + "T00:00:00Z") : undefined;
  let to = sp.to ? new Date(sp.to + "T23:59:59Z") : undefined;

  // Default to Today — never aggregate all-time so the page stays fast as
  // the order history grows. Every synced order is final (no status filter).
  if (!from && !to) {
    const today = startOfDayUTC(new Date());
    from = today;
    to = new Date(today.getTime() + 86_399_000);
  }

  const result = await listOrders({
    restaurantIds: [id],
    page,
    pageSize: PAGE_SIZE,
    from,
    to,
  });

  const rangeLabel = from && to
    ? `${fmtDate(from)} – ${fmtDate(to)}`
    : from
      ? `Since ${fmtDate(from)}`
      : "All time";
  const dayCount = from
    ? Math.max(1, Math.round(((to ?? new Date()).getTime() - from.getTime()) / 86_400_000) + 1)
    : null;

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/client/restaurants" className="hover:text-foreground">My Restaurants</Link>
        <span>/</span>
        <Link href={`/client/restaurants/${id}`} className="hover:text-foreground">{restaurant.name}</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Orders</span>
      </div>

      <RestaurantTabs restaurantId={id} active="orders" />

      <PageHeader
        title={`Orders · ${restaurant.name}`}
        description="Order history synced from the POS, with full item details."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Sales" value={formatRs(result.sum)} sub={rangeLabel} icon={Banknote} tone="positive" />
        <StatCard title="Orders" value={formatNumber(result.total)} sub={rangeLabel} icon={Receipt} />
        <StatCard
          title="Avg orders / day"
          value={dayCount ? (result.total / dayCount).toFixed(1) : "—"}
          sub={rangeLabel}
          icon={CalendarClock}
        />
      </div>

      <Suspense>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <DatePresets />
          <DateRangeFilter />
        </div>
      </Suspense>

      <Card>
        <CardContent className="p-0">
          {result.rows.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6 text-muted-foreground" />}
              title="No orders found"
              description="No synced orders match the current filters."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell><code className="text-sm">{o.orderNumber}</code></TableCell>
                      <TableCell className="text-sm">{fmtDate(o.orderDate)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtTime(o.orderDate)}</TableCell>
                      <TableCell className="text-sm tabular-nums">{o._count.items}</TableCell>
                      <TableCell><PaymentBadge method={o.paymentMethod} /></TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">{formatRs(o.total)}</TableCell>
                      <TableCell>
                        <Link
                          href={`/client/restaurants/${id}/orders/${o.id}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
                          aria-label={`View order ${o.orderNumber}`}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </TableCell>
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
