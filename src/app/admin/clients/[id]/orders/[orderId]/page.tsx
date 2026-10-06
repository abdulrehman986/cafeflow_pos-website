import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, PaymentBadge } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/shared/table-kit";
import { SupportAccessBanner } from "@/components/admin/support-banner";
import { requireSupportPage, requireSupportGate } from "@/lib/auth/guards";
import { logAudit } from "@/lib/services/support";
import { db } from "@/lib/db";
import { formatRs, fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSupportGate(id);
  return { title: "Order detail (support)" };
}

/** Support-access order detail — one client, active grant required, audited. */
export default async function SupportOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string; orderId: string }>;
}) {
  const { id, orderId } = await params;
  const support = await requireSupportPage(id);
  if (!support) notFound();
  const { user, grant } = support;

  const order = await db.order.findFirst({
    where: { id: orderId, restaurant: { clientId: id } },
    include: {
      restaurant: { select: { name: true } },
      items: { orderBy: { id: "asc" } },
    },
  });
  if (!order) notFound();

  const client = await db.client.findUnique({ where: { id }, select: { companyName: true } });
  if (!client) notFound();

  await logAudit({
    actorProfileId: user.profileId,
    actorEmail: user.email,
    action: "VIEW_ORDER_DETAIL",
    targetType: "Order",
    targetId: order.id,
    clientId: id,
    metadata: { grantId: grant.id, orderNumber: order.orderNumber },
  });

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/clients" className="hover:text-foreground">Clients</Link>
        <span>/</span>
        <Link href={`/admin/clients/${id}`} className="hover:text-foreground">{client.companyName}</Link>
        <span>/</span>
        <Link href={`/admin/clients/${id}/orders`} className="hover:text-foreground">Orders (support)</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{order.orderNumber}</span>
      </div>

      <SupportAccessBanner clientName={client.companyName} reason={grant.reason} expiresAt={grant.expiresAt} />

      <PageHeader
        title={`Order ${order.orderNumber}`}
        description={`${order.restaurant.name} · ${fmtDateTime(order.orderDate)}`}
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
                      <TableCell className="text-right text-sm font-semibold tabular-nums">{formatRs(item.total)}</TableCell>
                    </TableRow>
                  ))}
                  {order.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                        No line items were synced with this order.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatRs(order.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="tabular-nums">−{formatRs(order.discount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="tabular-nums">{formatRs(order.tax)}</span></div>
            <div className="flex justify-between border-t pt-3 text-base font-semibold"><span>Total</span><span className="tabular-nums">{formatRs(order.total)}</span></div>
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Payment</span><PaymentBadge method={order.paymentMethod} /></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Status</span><StatusBadge status={order.status} /></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Customers</span><span className="tabular-nums">{order.customerCount ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Synced at</span><span>{fmtDateTime(order.syncedAt)}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">POS reference</span><code className="text-xs break-all text-right">{order.localOrderId}</code></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
