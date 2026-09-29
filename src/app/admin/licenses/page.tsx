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
import { LicenseRowActions } from "@/components/admin/license-actions";
import { listLicenses } from "@/lib/services/restaurants";
import { formatNumber, fmtDate, fmtDateTime } from "@/lib/format";
import { licenseEffectiveStatus } from "@/lib/license-key";
import { KeyRound } from "lucide-react";
import { refreshExpiredLicenses } from "@/lib/services/licenses";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function AdminLicensesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  // Housekeeping: flip ACTIVE→EXPIRED where dates have passed (also done on dashboards)
  await refreshExpiredLicenses();

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const result = await listLicenses({
    page,
    pageSize: PAGE_SIZE,
    search: sp.q,
    status: sp.status,
  });

  const buckets = { expiringSoon: 0, expired: 0 };
  for (const l of result.items) {
    const eff = licenseEffectiveStatus(l);
    if (eff.effectiveStatus === "EXPIRED") buckets.expired++;
    else if (eff.effectiveStatus === "ACTIVE" && eff.daysRemaining <= 30) buckets.expiringSoon++;
  }

  return (
    <>
      <PageHeader
        title="Licenses"
        description={`${formatNumber(result.total)} licenses. Keys are generated server-side with cryptographic randomness.`}
      />

      <Suspense>
        <FilterToolbar
          searchPlaceholder="Search by license key…"
          filters={[
            {
              key: "status",
              placeholder: "All statuses",
              options: [
                { value: "ACTIVE", label: "Active" },
                { value: "PENDING", label: "Pending" },
                { value: "EXPIRED", label: "Expired" },
                { value: "SUSPENDED", label: "Suspended" },
                { value: "REVOKED", label: "Revoked" },
              ],
            },
          ]}
        />
      </Suspense>

      <Card>
        <CardContent className="p-0">
          {result.items.length === 0 ? (
            <EmptyState
              icon={<KeyRound className="h-6 w-6 text-muted-foreground" />}
              title="No licenses found"
              description="Licenses are issued when creating a restaurant, or from a restaurant's row actions."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>License key</TableHead>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-center">Devices</TableHead>
                    <TableHead>Last verified</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((l) => {
                    const eff = licenseEffectiveStatus(l);
                    return (
                      <TableRow key={l.id}>
                        <TableCell>
                          <code className="text-sm font-medium">{l.licenseKey}</code>
                          <p className="text-xs text-muted-foreground">Issued {fmtDate(l.createdAt)}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">{l.restaurantName}</p>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/admin/clients/${l.clientId}`}
                            className="text-sm hover:text-primary"
                          >
                            {l.clientName}
                          </Link>
                        </TableCell>
                        <TableCell><StatusBadge status={eff.effectiveStatus} /></TableCell>
                        <TableCell className="text-sm">
                          {fmtDate(l.expiresAt)}
                          <p className={`text-xs ${eff.daysRemaining <= 30 ? "text-amber-600" : "text-muted-foreground"}`}>
                            {l.status === "REVOKED" ? "—" : `${eff.daysRemaining} days left`}
                          </p>
                        </TableCell>
                        <TableCell className="text-center text-sm tabular-nums">
                          {l.activeDevices}/{l.maxDevices}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {l.lastVerifiedAt ? fmtDateTime(l.lastVerifiedAt) : "Never"}
                        </TableCell>
                        <TableCell>
                          <LicenseRowActions license={l} />
                        </TableCell>
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
