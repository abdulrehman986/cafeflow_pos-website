import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge, PaymentBadge } from "@/components/shared/status-badge";
import { CashDiffBadge } from "@/components/shared/cash-diff-badge";
import { PageHeader, EmptyState } from "@/components/shared/table-kit";
import { requireClientPage } from "@/lib/auth/guards";
import { getShiftDetail } from "@/lib/services/shifts";
import { db } from "@/lib/db";
import { formatRs, formatNumber, fmtDateTime, fmtTime, shiftRef } from "@/lib/format";
import {
  Banknote,
  Clock,
  Receipt,
  Wallet,
  MonitorSmartphone,
  CalendarClock,
  UserRound,
  Coins,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClientRestaurantShiftDetailPage({
  params,
}: {
  params: Promise<{ id: string; shiftId: string }>;
}) {
  const user = await requireClientPage();
  const { id, shiftId } = await params;

  // SECURITY: the shift must belong to a restaurant owned by this client
  const owned = await db.restaurant.findMany({
    where: { clientId: user.clientId! },
    select: { id: true },
  });
  const detail = await getShiftDetail({
    shiftId,
    restaurantIds: owned.map((r) => r.id),
  });
  if (!detail || detail.shift.restaurant.id !== id) notFound();

  const { shift, expenses, orders, ordersTotal, expensesTotal } = detail;
  const expected = shift.expectedCash ?? null;

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/client/restaurants" className="hover:text-foreground">My Restaurants</Link>
        <span>/</span>
        <Link href={`/client/restaurants/${id}`} className="hover:text-foreground">{shift.restaurant.name}</Link>
        <span>/</span>
        <Link href={`/client/restaurants/${id}/shifts`} className="hover:text-foreground">Shifts</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{shiftRef(shift.localShiftId, shift.openedAt)}</span>
      </div>

      <PageHeader
        title={shiftRef(shift.localShiftId, shift.openedAt)}
        description={`${shift.restaurant.name} · ${fmtDateTime(shift.openedAt)} → ${fmtDateTime(shift.closedAt)}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Net sales" value={formatRs(shift.netSales ?? 0)} icon={Banknote} tone="positive" />
        <StatCard title="Gross sales" value={formatRs(shift.grossSales ?? 0)} sub={shift.refundsTotal ? `Refunds ${formatRs(shift.refundsTotal)}` : undefined} icon={Receipt} />
        <StatCard title="Orders in shift" value={formatNumber(shift.orderCount ?? orders.length)} icon={Coins} />
        <StatCard
          title="Cash difference"
          value={(shift.cashDifference ?? 0).toFixed(2)}
          icon={Wallet}
          tone={Math.abs(shift.cashDifference ?? 0) < 0.005 ? "positive" : "danger"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Cash reconciliation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Cash reconciliation</CardTitle>
            <CardDescription>Drawer counts reported by the POS</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Opening cash</span><span className="tabular-nums">{shift.openingCash != null ? formatRs(shift.openingCash) : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Cash sales</span><span className="tabular-nums">{shift.grossSales != null ? formatRs(shift.grossSales) : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Expenses paid out</span><span className="tabular-nums">{formatRs(shift.expensesTotal ?? expensesTotal)}</span></div>
            <div className="flex justify-between border-t pt-3 font-medium"><span>Expected in drawer</span><span className="tabular-nums">{expected != null ? formatRs(expected) : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Counted (closing)</span><span className="tabular-nums">{shift.closingCash != null ? formatRs(shift.closingCash) : "—"}</span></div>
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-muted-foreground">Difference</span>
              <CashDiffBadge value={shift.cashDifference} />
            </div>
            <div className="border-t pt-3 space-y-2 text-xs text-muted-foreground">
              <p className="flex items-center gap-2"><UserRound className="h-3.5 w-3.5" /> Cashier: {shift.cashierName ?? "—"}</p>
              <p className="flex items-center gap-2"><MonitorSmartphone className="h-3.5 w-3.5" /> Terminal: {shift.device ? (shift.device.deviceName ?? shift.device.deviceIdentifier) : "Unattributed"}</p>
              <p className="flex items-center gap-2"><CalendarClock className="h-3.5 w-3.5" /> Synced: {fmtDateTime(shift.syncedAt)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Expenses recorded during the shift */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Expenses in this shift</CardTitle>
            <CardDescription>Cash paid out while the shift was open</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {expenses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center px-6">
                No expenses were recorded during this shift.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Cashier</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm whitespace-nowrap">{fmtDateTime(e.date)}</TableCell>
                      <TableCell className="text-sm">{e.category ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.description ?? "—"}</TableCell>
                      <TableCell className="text-sm">{e.cashierName ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">{formatRs(e.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Orders rung up during the shift */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transactions in this shift</CardTitle>
              <CardDescription>
                Orders rung up between opening and closing{shift.deviceId ? " on this terminal" : ""} — {formatRs(ordersTotal)} total
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <EmptyState
              icon={<Clock className="h-6 w-6 text-muted-foreground" />}
              title="No orders matched"
              description="No orders fall inside this shift's time window."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link href={`/client/restaurants/${id}/orders/${o.id}`} className="text-sm font-medium hover:text-primary">
                          <code>{o.orderNumber}</code>
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtTime(o.orderDate)}</TableCell>
                      <TableCell className="text-sm tabular-nums">{o._count.items}</TableCell>
                      <TableCell><PaymentBadge method={o.paymentMethod} /></TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">{formatRs(o.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
