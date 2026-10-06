import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge, PaymentBadge } from "@/components/shared/status-badge";
import { PageHeader, EmptyState } from "@/components/shared/table-kit";
import { UrlPagination } from "@/components/shared/filter-toolbar";
import { DateRangeFilter, DatePresets } from "@/components/shared/date-range-filter";
import { SupportAccessBanner } from "@/components/admin/support-banner";
import { requireSupportPage, requireSupportGate } from "@/lib/auth/guards";
import { listSales } from "@/lib/services/dashboard";
import { logAudit } from "@/lib/services/support";
import { db } from "@/lib/db";
import { formatRs, formatNumber, fmtDate, fmtTime } from "@/lib/format";
import { Receipt, Banknote, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSupportGate(id);
  return { title: "Sales (support)" };
}

/** Support-access sales list — scoped to ONE client, requires an active grant. */
export default async function SupportClientSalesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; paymentMethod?: string; page?: string }>;
}) {
  const { id } = await params;
  const support = await requireSupportPage(id);
  if (!support) notFound();
  const { user, grant } = support;

  const client = await db.client.findUnique({
    where: { id },
    select: { companyName: true, restaurants: { select: { id: true } } },
  });
  if (!client) notFound();

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const from = sp.from ? new Date(sp.from + "T00:00:00Z") : undefined;
  const to = sp.to ? new Date(sp.to + "T23:59:59Z") : undefined;

  await logAudit({
    actorProfileId: user.profileId,
    actorEmail: user.email,
    action: "VIEW_SALES",
    targetType: "Client",
    targetId: id,
    clientId: id,
    metadata: { grantId: grant.id, page, from: sp.from ?? null, to: sp.to ?? null },
  });

  const result = await listSales({
    restaurantIds: client.restaurants.map((r) => r.id),
    page,
    pageSize: PAGE_SIZE,
    from,
    to,
    paymentMethod: sp.paymentMethod,
  });
  const avg = result.total > 0 ? result.sum / result.total : 0;

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/clients" className="hover:text-foreground">Clients</Link>
        <span>/</span>
        <Link href={`/admin/clients/${id}`} className="hover:text-foreground">{client.companyName}</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Sales (support)</span>
      </div>

      <SupportAccessBanner clientName={client.companyName} reason={grant.reason} expiresAt={grant.expiresAt} />

      <PageHeader
        title={`Sales · ${client.companyName}`}
        description="Read-only support view of this client's individual sales transactions."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Filtered revenue" value={formatRs(result.sum)} icon={Banknote} tone="positive" />
        <StatCard title="Transactions" value={formatNumber(result.total)} icon={Receipt} />
        <StatCard title="Average transaction" value={formatRs(avg)} icon={TrendingUp} />
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
              title="No sales found"
              description="No sales match the current filters."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sale #</TableHead>
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
                      <TableCell><code className="text-sm">{s.saleNumber ?? s.localSaleId}</code></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.restaurant.name}</TableCell>
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
