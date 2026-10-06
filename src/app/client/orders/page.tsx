import Link from "next/link";
import { Fragment, Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge, PaymentBadge } from "@/components/shared/status-badge";
import { PageHeader, EmptyState } from "@/components/shared/table-kit";
import { UrlPagination, FilterToolbar } from "@/components/shared/filter-toolbar";
import { DateRangeFilter, DatePresets } from "@/components/shared/date-range-filter";
import { requireClientPage } from "@/lib/auth/guards";
import { listOrders } from "@/lib/services/dashboard";
import { db } from "@/lib/db";
import { formatRs, formatNumber, fmtDate, fmtTime, shiftRef } from "@/lib/format";
import { Receipt, Banknote, ChevronRight, Clock, X } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

/** Order history across ALL of the owner's restaurants, filterable by status,
 *  date range and — for shift-wise review — by a specific POS shift. */
export default async function ClientOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string; q?: string; shift?: string; page?: string }>;
}) {
  const user = await requireClientPage();

  const restaurants = await db.restaurant.findMany({
    where: { clientId: user.clientId! },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  const restaurantIds = restaurants.map((r) => r.id);

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  let from = sp.from ? new Date(sp.from + "T00:00:00Z") : undefined;
  let to = sp.to ? new Date(sp.to + "T23:59:59Z") : undefined;

  // Shift-wise filter: narrow to one shift's window (and terminal, when known).
  const activeShift = sp.shift
    ? await db.shift.findFirst({
        where: { id: sp.shift, restaurantId: { in: restaurantIds } },
        include: { restaurant: { select: { name: true } }, device: { select: { deviceName: true, deviceIdentifier: true } } },
      })
    : null;
  if (activeShift) {
    from = activeShift.openedAt;
    to = activeShift.closedAt;
  }

  const [result, recentShifts] = await Promise.all([
    listOrders({
      restaurantIds,
      page,
      pageSize: PAGE_SIZE,
      from,
      to,
      status: sp.status,
      search: sp.q,
      deviceId: activeShift?.deviceId ?? undefined,
    }),
    // Dropdown options: the most recent shifts across the owner's restaurants
    restaurantIds.length
      ? db.shift.findMany({
          where: { restaurantId: { in: restaurantIds } },
          orderBy: { openedAt: "desc" },
          take: 30,
          select: { id: true, localShiftId: true, openedAt: true },
        })
      : Promise.resolve([]),
  ]);
  const avg = result.total > 0 ? result.sum / result.total : 0;

  const rangeLabel = activeShift
    ? `Shift ${shiftRef(activeShift.localShiftId, activeShift.openedAt)}`
    : from && to
      ? `${fmtDate(from)} – ${fmtDate(to)}`
      : "All time";

  // Group rows by day so long ranges stay scannable
  const groups: Array<{ day: string; rows: typeof result.rows }> = [];
  for (const row of result.rows) {
    const day = row.orderDate.toISOString().slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(row);
    else groups.push({ day, rows: [row] });
  }

  return (
    <>
      <PageHeader
        title="Orders"
        description="Order history across all your restaurants, synced from your POS terminals."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Filtered order value" value={formatRs(result.sum)} sub={rangeLabel} icon={Banknote} tone="positive" />
        <StatCard title="Orders" value={formatNumber(result.total)} sub={rangeLabel} icon={Receipt} />
        <StatCard title="Average order" value={formatRs(avg)} sub={rangeLabel} icon={ChevronRight} />
      </div>

      <Suspense>
        <FilterToolbar
          searchPlaceholder="Search order number…"
          filters={[
            {
              key: "status",
              placeholder: "All statuses",
              options: [
                { value: "COMPLETED", label: "Completed" },
                { value: "PENDING", label: "Pending" },
                { value: "REFUNDED", label: "Refunded" },
                { value: "CANCELLED", label: "Cancelled" },
              ],
            },
            {
              key: "shift",
              placeholder: "All shifts",
              options: recentShifts.map((s) => ({
                value: s.id,
                label: `${shiftRef(s.localShiftId, s.openedAt)} · ${fmtDate(s.openedAt)}`,
              })),
            },
          ]}
        />
        {!activeShift ? (
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <DatePresets />
            <DateRangeFilter />
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="flex flex-wrap items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Showing orders for <code className="font-medium">{shiftRef(activeShift.localShiftId, activeShift.openedAt)}</code>
              {" "}· {activeShift.restaurant.name} · {fmtDate(activeShift.openedAt)}, {fmtTime(activeShift.openedAt)} – {fmtTime(activeShift.closedAt)}
              {activeShift.device ? ` · ${activeShift.device.deviceName ?? activeShift.device.deviceIdentifier}` : ""}
            </span>
            <Link href="/client/orders" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" /> Clear shift filter
            </Link>
          </div>
        )}
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
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => (
                    <Fragment key={group.day}>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell colSpan={8} className="h-8 py-1.5 text-xs font-medium text-muted-foreground">
                          {fmtDate(group.day + "T00:00:00Z")}
                        </TableCell>
                      </TableRow>
                      {group.rows.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell><code className="text-sm">{o.orderNumber}</code></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{o.restaurant.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{fmtTime(o.orderDate)}</TableCell>
                          <TableCell className="text-sm tabular-nums">{o._count.items}</TableCell>
                          <TableCell><PaymentBadge method={o.paymentMethod} /></TableCell>
                          <TableCell><StatusBadge status={o.status} /></TableCell>
                          <TableCell className="text-right text-sm font-semibold tabular-nums">{formatRs(o.total)}</TableCell>
                          <TableCell>
                            <Link
                              href={`/client/restaurants/${o.restaurantId}/orders/${o.id}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
                              aria-label={`View order ${o.orderNumber}`}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
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
