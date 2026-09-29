import { Suspense } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, PaymentBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { PageHeader, EmptyState } from "@/components/shared/table-kit";
import { FilterToolbar, UrlPagination } from "@/components/shared/filter-toolbar";
import { DateRangeFilter, DatePresets } from "@/components/shared/date-range-filter";
import { listSales } from "@/lib/services/dashboard";
import { formatRs, formatNumber, fmtDate, fmtTime } from "@/lib/format";
import { db } from "@/lib/db";
import { Banknote, Receipt, Coins, CalendarRange } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export default async function AdminSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string; paymentMethod?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const restaurantIds = (await db.restaurant.findMany({ select: { id: true } })).map((r) => r.id);

  const from = sp.from ? new Date(sp.from + "T00:00:00Z") : undefined;
  const to = sp.to ? new Date(sp.to + "T23:59:59Z") : undefined;

  const result = await listSales({
    restaurantIds,
    page,
    pageSize: PAGE_SIZE,
    from,
    to,
    paymentMethod: sp.paymentMethod,
    search: sp.q,
  });

  const avg = result.total > 0 ? result.sum / result.total : 0;

  return (
    <>
      <PageHeader
        title="Sales"
        description="All synced sales transactions across every restaurant on the platform."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Filtered revenue" value={formatRs(result.sum)} icon={Banknote} tone="positive" />
        <StatCard title="Transactions" value={formatNumber(result.total)} icon={Receipt} />
        <StatCard title="Average sale" value={formatRs(avg)} icon={Coins} />
      </div>

      <div className="space-y-3">
        <Suspense>
          <FilterToolbar
            searchPlaceholder="Search sale number…"
            filters={[
              {
                key: "paymentMethod",
                placeholder: "All payments",
                options: [
                  { value: "CASH", label: "Cash" },
                  { value: "CARD", label: "Card" },
                  { value: "MOBILE", label: "Mobile wallet" },
                  { value: "OTHER", label: "Other" },
                ],
              },
            ]}
          />
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <DatePresets />
            <DateRangeFilter />
          </div>
        </Suspense>
      </div>

      <Card>
        <CardContent className="p-0">
          {result.rows.length === 0 ? (
            <EmptyState
              icon={<CalendarRange className="h-6 w-6 text-muted-foreground" />}
              title="No sales found"
              description="Sales appear here once POS terminals sync. Try widening the date range."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sale</TableHead>
                    <TableHead>Restaurant</TableHead>
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
                      <TableCell>
                        <code className="text-sm">{s.saleNumber ?? s.localSaleId.slice(0, 8)}</code>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/orders?restaurantId=${s.restaurantId}`}
                          className="text-sm hover:text-primary"
                        >
                          {s.restaurant.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{fmtDate(s.saleDate)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtTime(s.saleDate)}</TableCell>
                      <TableCell><PaymentBadge method={s.paymentMethod} /></TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">
                        {formatRs(s.total)}
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
