import Link from "next/link";
import { Suspense } from "react";
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
import { formatRs, formatNumber, fmtDate, fmtTime } from "@/lib/format";
import { Receipt, Banknote, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

/** Order history across ALL of the owner's restaurants. */
export default async function ClientOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string; q?: string; page?: string }>;
}) {
  const user = await requireClientPage();

  const restaurants = await db.restaurant.findMany({
    where: { clientId: user.clientId! },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const from = sp.from ? new Date(sp.from + "T00:00:00Z") : undefined;
  const to = sp.to ? new Date(sp.to + "T23:59:59Z") : undefined;

  const result = await listOrders({
    restaurantIds: restaurants.map((r) => r.id),
    page,
    pageSize: PAGE_SIZE,
    from,
    to,
    status: sp.status,
    search: sp.q,
  });
  const avg = result.total > 0 ? result.sum / result.total : 0;

  return (
    <>
      <PageHeader
        title="Orders"
        description="Order history across all your restaurants, synced from your POS terminals."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Filtered order value" value={formatRs(result.sum)} icon={Banknote} tone="positive" />
        <StatCard title="Orders" value={formatNumber(result.total)} icon={Receipt} />
        <StatCard title="Average order" value={formatRs(avg)} icon={ChevronRight} />
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
          ]}
        />
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
                    <TableHead>Restaurant</TableHead>
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
                      <TableCell className="text-sm text-muted-foreground">{o.restaurant.name}</TableCell>
                      <TableCell className="text-sm">{fmtDate(o.orderDate)}</TableCell>
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
