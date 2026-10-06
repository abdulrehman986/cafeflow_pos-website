import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/shared/stat-card";
import { PageHeader, EmptyState } from "@/components/shared/table-kit";
import { RestaurantTabs } from "@/components/client/restaurant-tabs";
import { UrlPagination } from "@/components/shared/filter-toolbar";
import { DateRangeFilter, DatePresets } from "@/components/shared/date-range-filter";
import { CashDiffBadge } from "@/components/shared/cash-diff-badge";
import { requireClientPage, assertRestaurantAccess } from "@/lib/auth/guards";
import { listShifts } from "@/lib/services/shifts";
import { formatRs, formatNumber, fmtDateTime, fmtTime, shiftRef } from "@/lib/format";
import { Clock, Banknote, Receipt, Wallet, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export default async function ClientRestaurantShiftsPage({
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
  const from = sp.from ? new Date(sp.from + "T00:00:00Z") : undefined;
  const to = sp.to ? new Date(sp.to + "T23:59:59Z") : undefined;

  const result = await listShifts({ restaurantIds: [id], page, pageSize: PAGE_SIZE, from, to });
  const avgNet = result.total > 0 ? result.sumNet / result.total : 0;

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/client/restaurants" className="hover:text-foreground">My Restaurants</Link>
        <span>/</span>
        <Link href={`/client/restaurants/${id}`} className="hover:text-foreground">{restaurant.name}</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Shifts</span>
      </div>

      <RestaurantTabs restaurantId={id} active="shifts" />

      <PageHeader
        title={`Shifts · ${restaurant.name}`}
        description="Completed shift reconciliations uploaded by your POS terminals, with full cash-drawer detail."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Shifts" value={formatNumber(result.total)} icon={Clock} />
        <StatCard title="Net sales (filtered)" value={formatRs(result.sumNet)} icon={Banknote} tone="positive" />
        <StatCard title="Gross sales (filtered)" value={formatRs(result.sumGross)} icon={Wallet} />
        <StatCard title="Average net / shift" value={formatRs(avgNet)} icon={Receipt} />
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
              icon={<Clock className="h-6 w-6 text-muted-foreground" />}
              title="No shifts found"
              description="Shifts appear here once your POS closes a shift and syncs it."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shift</TableHead>
                    <TableHead>Terminal</TableHead>
                    <TableHead>Opened</TableHead>
                    <TableHead>Closed</TableHead>
                    <TableHead>Cashier</TableHead>
                    <TableHead className="text-center">Orders</TableHead>
                    <TableHead className="text-right">Net sales</TableHead>
                    <TableHead className="text-right">Cash diff</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell><code className="text-sm">{shiftRef(s.localShiftId, s.openedAt)}</code></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.device ? (s.device.deviceName ?? s.device.deviceIdentifier) : "Unattributed"}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{fmtDateTime(s.openedAt)}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{fmtTime(s.closedAt)}</TableCell>
                      <TableCell className="text-sm">{s.cashierName ?? "—"}</TableCell>
                      <TableCell className="text-center text-sm tabular-nums">{s.orderCount ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">{formatRs(s.netSales ?? 0)}</TableCell>
                      <TableCell className="text-right"><CashDiffBadge value={s.cashDifference} /></TableCell>
                      <TableCell>
                        <Link
                          href={`/client/restaurants/${id}/shifts/${s.id}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
                          aria-label={`View shift ${s.shiftNumber ?? ""}`}
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
