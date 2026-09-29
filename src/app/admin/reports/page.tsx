import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/table-kit";
import { SalesTrendChart, PaymentMethodChart } from "@/components/dashboard/charts";
import { StatCard } from "@/components/shared/stat-card";
import { refreshExpiredLicenses } from "@/lib/services/licenses";
import { getAdminSalesTrend, getAdminPaymentSplit, getTopRestaurants } from "@/lib/services/dashboard";
import { db } from "@/lib/db";
import { formatRs, formatNumber } from "@/lib/format";
import { Banknote, Receipt, Users, Store } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  await refreshExpiredLicenses();

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const d30 = new Date(now.getTime() - 30 * 86400000);

  const [trend, paymentSplit, topRestaurants, clientsRanking, totals] = await Promise.all([
    getAdminSalesTrend(30),
    getAdminPaymentSplit(),
    getTopRestaurants(10),
    db.client.findMany({
      select: {
        id: true,
        companyName: true,
        restaurants: {
          select: { sales: { where: { status: "COMPLETED", saleDate: { gte: d30 } }, select: { total: true } } },
        },
      },
    }),
    db.sale.aggregate({ where: { status: "COMPLETED" }, _sum: { total: true }, _count: true }),
  ]);

  const clientRows = clientsRanking
    .map((c) => ({
      id: c.id,
      name: c.companyName,
      revenue30: c.restaurants.reduce((a, r) => a + r.sales.reduce((x, s) => x + s.total, 0), 0),
    }))
    .filter((c) => c.revenue30 > 0)
    .sort((a, b) => b.revenue30 - a.revenue30)
    .slice(0, 10);

  return (
    <>
      <PageHeader
        title="Reports"
        description="Platform-wide revenue analytics for the last 30 days, this month and lifetime."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Lifetime synced revenue" value={formatRs(totals._sum.total ?? 0)} icon={Banknote} tone="positive" />
        <StatCard title="Lifetime sales records" value={formatNumber(totals._count)} icon={Receipt} />
        <StatCard title="Active clients" value={formatNumber(await db.client.count({ where: { status: "ACTIVE" } }))} icon={Users} />
        <StatCard title="Active restaurants" value={formatNumber(await db.restaurant.count({ where: { status: "ACTIVE" } }))} icon={Store} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Daily revenue — last 30 days</CardTitle>
          <CardDescription>All restaurants, all clients</CardDescription>
        </CardHeader>
        <CardContent>
          <SalesTrendChart data={trend} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Payment methods — this month</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentMethodChart data={paymentSplit} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Top restaurants — this month</CardTitle>
            <CardDescription>By synced revenue</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topRestaurants.map((r) => (
                    <TableRow key={r.name + r.client}>
                      <TableCell className="text-sm font-medium">{r.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.client}</TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">{formatRs(r.total)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{formatNumber(r.orders)}</TableCell>
                    </TableRow>
                  ))}
                  {topRestaurants.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                        No synced sales yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Client revenue ranking — last 30 days</CardTitle>
          <CardDescription>Businesses by total synced revenue across their restaurants</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Revenue (30d)</TableHead>
                  <TableHead className="text-right w-32">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientRows.map((c, i) => {
                  const max = clientRows[0]?.revenue30 || 1;
                  const share = Math.round((c.revenue30 / max) * 100);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm text-muted-foreground tabular-nums">{i + 1}</TableCell>
                      <TableCell>
                        <Link href={`/admin/clients/${c.id}`} className="text-sm font-medium hover:text-primary">
                          {c.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">{formatRs(c.revenue30)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 justify-end">
                          <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${share}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{share}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {clientRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                      No synced sales in the last 30 days.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
