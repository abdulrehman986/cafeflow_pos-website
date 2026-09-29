import Link from "next/link";
import { Suspense } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader, EmptyState } from "@/components/shared/table-kit";
import { FilterToolbar, UrlPagination } from "@/components/shared/filter-toolbar";
import { CreateRestaurantDialog } from "@/components/admin/create-restaurant-dialog";
import { listRestaurants } from "@/lib/services/restaurants";
import { db } from "@/lib/db";
import { formatNumber, fmtDate } from "@/lib/format";
import { licenseEffectiveStatus } from "@/lib/license-key";
import { Store, Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function AdminRestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; clientId?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const [result, activeClients] = await Promise.all([
    listRestaurants({
      page,
      pageSize: PAGE_SIZE,
      search: sp.q,
      status: sp.status,
      clientId: sp.clientId,
    }),
    db.client.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Restaurants"
        description={`${formatNumber(result.total)} locations across all clients. Each is a fully isolated workspace.`}
        actions={<CreateRestaurantDialog clients={activeClients} />}
      />

      <Suspense>
        <FilterToolbar
          searchPlaceholder="Search by name or city…"
          filters={[
            {
              key: "status",
              placeholder: "All statuses",
              options: [
                { value: "ACTIVE", label: "Active" },
                { value: "SUSPENDED", label: "Suspended" },
                { value: "DEACTIVATED", label: "Deactivated" },
              ],
            },
          ]}
        />
      </Suspense>

      <Card>
        <CardContent className="p-0">
          {result.items.length === 0 ? (
            <EmptyState
              icon={<Store className="h-6 w-6 text-muted-foreground" />}
              title="No restaurants found"
              description="Add a restaurant to a client, then issue its license."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>License</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-center">Devices</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((r) => {
                    const eff = r.licenseExpiresAt
                      ? licenseEffectiveStatus({ status: r.licenseStatus, expiresAt: r.licenseExpiresAt })
                      : null;
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <p className="font-medium">{r.name}</p>
                          {r.city && <p className="text-xs text-muted-foreground">{r.city}</p>}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/admin/clients/${r.clientId}`}
                            className="text-sm hover:text-primary inline-flex items-center gap-1.5"
                          >
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            {r.clientName}
                          </Link>
                        </TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                        <TableCell>
                          {r.licenseKey ? (
                            <code className="text-xs">{r.licenseKey}</code>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {eff && <div className="mt-1"><StatusBadge status={eff.effectiveStatus} /></div>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.licenseExpiresAt ? (
                            <>
                              {fmtDate(r.licenseExpiresAt)}
                              <p className="text-xs text-muted-foreground">{eff!.daysRemaining} days left</p>
                            </>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-center text-sm tabular-nums">
                          {r.activeDevices}/{r.maxDevices || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtDate(r.createdAt)}</TableCell>
                      </TableRow>
                    );
                  })}
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
