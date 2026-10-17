import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/table-kit";
import { OrdersTrendChart, PaymentMethodOrdersChart } from "@/components/dashboard/charts";
import { StatCard } from "@/components/shared/stat-card";
import { refreshExpiredLicenses } from "@/lib/services/licenses";
import { getAdminOrderTrend, getAdminPaymentOrdersSplit, getTopRestaurants, getTopClientsByOrders } from "@/lib/services/dashboard";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/format";
import { Receipt, Users, Store } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  await refreshExpiredLicenses();

  const [trend, paymentSplit, topRestaurants, clientRows, totals] = await Promise.all([
    getAdminOrderTrend(30),
    getAdminPaymentOrdersSplit(),
    getTopRestaurants(10),
    getTopClientsByOrders(30, 10),
    // Lifetime order count only — client revenue never appears on the admin side.
    db.sale.aggregate({ where: { status: "COMPLETED" }, _count: true }),
  ]);

  return (
    <>
      <PageHeader
        title="Reports"
        description="Platform-wide order analytics for the last 30 days and lifetime. Client revenue is never shown here."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Lifetime synced orders" value={formatNumber(totals._count)} icon={Receipt} tone="positive" />
        <StatCard title="Active clients" value={formatNumber(await db.client.count({ where: { status: "ACTIVE" } }))} icon={Users} />
        <StatCard title="Active restaurants" value={formatNumber(await db.restaurant.count({ where: { status: "ACTIVE" } }))} icon={Store} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Daily orders — last 30 days</CardTitle>
          <CardDescription>All restaurants, all clients</CardDescription>
        </CardHeader>
        <CardContent>
          <OrdersTrendChart data={trend} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Payment methods — this month</CardTitle>
            <CardDescription>By order count</CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentMethodOrdersChart data={paymentSplit} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Top restaurants — this month</CardTitle>
            <CardDescription>By synced order volume</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topRestaurants.map((r) => (
                    <TableRow key={r.name + r.client}>
                      <TableCell className="text-sm font-medium">{r.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.client}</TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">{formatNumber(r.orders)}</TableCell>
                    </TableRow>
                  ))}
                  {topRestaurants.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                        No synced orders yet.
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
          <CardTitle>Client order ranking — last 30 days</CardTitle>
          <CardDescription>Businesses by total synced orders across their restaurants</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Orders (30d)</TableHead>
                  <TableHead className="text-right w-32">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientRows.map((c, i) => {
                  const max = clientRows[0]?.orders || 1;
                  const share = Math.round((c.orders / max) * 100);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm text-muted-foreground tabular-nums">{i + 1}</TableCell>
                      <TableCell>
                        <Link href={`/admin/clients/${c.id}`} className="text-sm font-medium hover:text-primary">
                          {c.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">{formatNumber(c.orders)}</TableCell>
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
                      No synced orders in the last 30 days.
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
