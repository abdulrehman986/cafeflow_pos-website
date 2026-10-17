import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/shared/stat-card";
import { PageHeader, EmptyState } from "@/components/shared/table-kit";
import { UrlPagination, SelectFilter } from "@/components/shared/filter-toolbar";
import { DateRangeFilter, DatePresets } from "@/components/shared/date-range-filter";
import { CashDiffBadge } from "@/components/shared/cash-diff-badge";
import { OpenShiftCard } from "@/components/client/open-shift-card";
import { requireClientPage } from "@/lib/auth/guards";
import { listShifts, getOpenShifts } from "@/lib/services/shifts";
import { db } from "@/lib/db";
import { formatRs, formatNumber, fmtDateTime, fmtTime, shiftRef } from "@/lib/format";
import { Clock, Banknote, Receipt, Wallet, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

/** Completed shift reconciliations across ALL of the owner's restaurants,
 *  plus a live view of the shift currently open on each terminal. */
export default async function ClientShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; restaurant?: string; page?: string }>;
}) {
  const user = await requireClientPage();

  const restaurants = await db.restaurant.findMany({
    where: { clientId: user.clientId! },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const from = sp.from ? new Date(sp.from + "T00:00:00Z") : undefined;
  const to = sp.to ? new Date(sp.to + "T23:59:59Z") : undefined;

  // Restaurant scope: "All restaurants" by default, or one specific location
  // (validated against the client's own restaurants — never trust the URL).
  const selectedRestaurant = restaurants.find((r) => r.id === sp.restaurant) ?? null;
  const restaurantIds = selectedRestaurant
    ? [selectedRestaurant.id]
    : restaurants.map((r) => r.id);

  const [result, openShifts] = await Promise.all([
    listShifts({
      restaurantIds,
      page,
      pageSize: PAGE_SIZE,
      from,
      to,
    }),
    getOpenShifts(selectedRestaurant ? [selectedRestaurant] : restaurants),
  ]);
  const avgNet = result.total > 0 ? result.sumNet / result.total : 0;

  return (
    <>
      <PageHeader
        title="Shifts"
        description={
          selectedRestaurant
            ? `Shift reconciliations for ${selectedRestaurant.name}, with cash-drawer detail — plus the shift currently open on its terminal.`
            : "Completed shift reconciliations across all your restaurants, with cash-drawer detail — plus the shift currently open on each terminal."
        }
      />

      <OpenShiftCard openShifts={openShifts} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Shifts" value={formatNumber(result.total)} icon={Clock} />
        <StatCard title="Net sales (filtered)" value={formatRs(result.sumNet)} icon={Banknote} tone="positive" />
        <StatCard title="Gross sales (filtered)" value={formatRs(result.sumGross)} icon={Wallet} />
        <StatCard title="Average net / shift" value={formatRs(avgNet)} icon={Receipt} />
      </div>

      <Suspense>
        <div className="flex flex-col lg:flex-row gap-3 lg:items-start justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <SelectFilter
              filterKey="restaurant"
              placeholder="All restaurants"
              options={restaurants.map((r) => ({ value: r.id, label: r.name }))}
              className="w-full sm:w-[210px]"
            />
            <DatePresets />
          </div>
          <DateRangeFilter />
        </div>
      </Suspense>

      <Card>
        <CardContent className="p-0">
          {result.rows.length === 0 ? (
            <EmptyState
              icon={<Clock className="h-6 w-6 text-muted-foreground" />}
              title="No shifts found"
              description="Shifts appear here once your POS terminals close a shift and sync it."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shift</TableHead>
                    {!selectedRestaurant && <TableHead>Restaurant</TableHead>}
                    <TableHead>Terminal</TableHead>
                    <TableHead>Opened</TableHead>
                    <TableHead>Closed</TableHead>
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
                      {!selectedRestaurant && (
                        <TableCell className="text-sm">{s.restaurant.name}</TableCell>
                      )}
                      <TableCell className="text-sm text-muted-foreground">{s.device ? (s.device.deviceName ?? s.device.deviceIdentifier) : "Unattributed"}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{fmtDateTime(s.openedAt)}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{fmtTime(s.closedAt)}</TableCell>
                      <TableCell className="text-center text-sm tabular-nums">{s.orderCount ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">{formatRs(s.netSales ?? 0)}</TableCell>
                      <TableCell className="text-right"><CashDiffBadge value={s.cashDifference} /></TableCell>
                      <TableCell>
                        <Link
                          href={`/client/restaurants/${s.restaurantId}/shifts/${s.id}`}
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
