import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRs, fmtDateTime, fmtTime } from "@/lib/format";
import { ChevronRight } from "lucide-react";
import type { OpenShiftView } from "@/lib/services/shifts";

/**
 * Live "currently open shift" card. The POS uploads a shift only when it
 * CLOSES, so the running shift cannot exist in the shifts table — it is
 * inferred from the orders that synced after the last closed shift.
 * "Orders so far" / "Sales so far" are those running totals; opening/closing
 * cash and the cash-drawer difference appear once the terminal closes the
 * shift and it syncs.
 *
 * Shared by the all-restaurants Shifts page and each restaurant's Shifts tab.
 */
export function OpenShiftCard({
  openShifts,
  ordersHrefBase = "/client/orders",
}: {
  openShifts: OpenShiftView[];
  /** Base path of the order list the row should drill into. */
  ordersHrefBase?: string;
}) {
  if (openShifts.length === 0) return null;

  return (
    <Card className="border-emerald-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Currently open shift
        </CardTitle>
        <CardDescription>
          Live totals from orders synced since the last closed shift. Opening/closing
          cash and the cash-drawer difference appear here once the terminal closes the
          shift and it syncs.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Restaurant</TableHead>
                <TableHead>Activity since</TableHead>
                <TableHead>Last order</TableHead>
                <TableHead className="text-center">Orders so far</TableHead>
                <TableHead className="text-right">Sales so far</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {openShifts.map((s) => (
                <TableRow key={s.restaurantId}>
                  <TableCell className="text-sm font-medium">{s.restaurantName}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {fmtTime(s.since)}
                    {s.lastClosedAt && (
                      <span className="text-xs text-muted-foreground">
                        {" "}· since last close {fmtDateTime(s.lastClosedAt)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                    {fmtDateTime(s.lastOrderAt)}
                  </TableCell>
                  <TableCell className="text-center text-sm font-semibold tabular-nums">
                    {s.orderCount}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums">
                    {formatRs(s.netSales)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`${ordersHrefBase}?from=${s.since.toISOString().slice(0, 10)}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
                      aria-label={`View live orders for ${s.restaurantName}`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
