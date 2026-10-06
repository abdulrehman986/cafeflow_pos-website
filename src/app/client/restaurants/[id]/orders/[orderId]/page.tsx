import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, PaymentBadge } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/shared/table-kit";
import { RestaurantTabs } from "@/components/client/restaurant-tabs";
import { requireClientPage, assertRestaurantAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { formatRs, fmtDate, fmtTime, fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClientOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string; orderId: string }>;
}) {
  const user = await requireClientPage();
  const { id, orderId } = await params;

  // SECURITY: restaurant must belong to the logged-in client
  const access = await assertRestaurantAccess(user, id);
  if (!access.ok) notFound();
  const restaurant = access.restaurant;

  // SECURITY: order must belong to this restaurant (already ownership-checked)
  const order = await db.order.findFirst({
    where: { id: orderId, restaurantId: id },
    include: { items: { orderBy: { name: "asc" } } },
  });
  if (!order) notFound();

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/client/restaurants" className="hover:text-foreground">My Restaurants</Link>
        <span>/</span>
        <Link href={`/client/restaurants/${id}`} className="hover:text-foreground">{restaurant.name}</Link>
        <span>/</span>
        <Link href={`/client/restaurants/${id}/orders`} className="hover:text-foreground">Orders</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{order.orderNumber}</span>
      </div>

      <RestaurantTabs restaurantId={id} active="orders" />

      <PageHeader
        title={`Order ${order.orderNumber}`}
        description={restaurant.name}
        actions={<StatusBadge status={order.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Items ({order.items.length})</CardTitle>
            <CardDescription>Line items synced from the POS</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm font-medium">{item.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.category ?? "—"}</TableCell>
                      <TableCell className="text-center text-sm tabular-nums">{item.quantity}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{formatRs(item.unitPrice)}</TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">{formatRs(item.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatRs(order.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="tabular-nums text-red-600">−{formatRs(order.discount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="tabular-nums">{formatRs(order.tax)}</span></div>
              <div className="border-t pt-2.5 flex justify-between font-semibold">
                <span>Total</span><span className="tabular-nums">{formatRs(order.total)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{fmtDate(order.orderDate)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span>{fmtTime(order.orderDate)}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Payment</span>
                <PaymentBadge method={order.paymentMethod} />
              </div>
              {order.customerCount !== null && (
                <div className="flex justify-between"><span className="text-muted-foreground">Customers</span><span>{order.customerCount}</span></div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Synced</span><span>{fmtDateTime(order.syncedAt)}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
