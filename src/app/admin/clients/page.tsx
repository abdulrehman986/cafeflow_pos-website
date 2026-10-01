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
import { CreateClientDialog } from "@/components/admin/create-client-dialog";
import { listClients } from "@/lib/services/clients";
import { formatNumber, fmtDate } from "@/lib/format";
import { Users, Building2, KeyRound, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const result = await listClients({
    page,
    pageSize: PAGE_SIZE,
    search: sp.q,
    status: sp.status,
  });

  return (
    <>
      <PageHeader
        title="Clients"
        description={`${formatNumber(result.total)} businesses on the CafeFlow platform.`}
        actions={<CreateClientDialog />}
      />

      <Suspense>
        <FilterToolbar
          searchPlaceholder="Search by name, business or email…"
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
              icon={<Users className="h-6 w-6 text-muted-foreground" />}
              title="No clients found"
              description={
                sp.q || sp.status
                  ? "Try adjusting your search or filters."
                  : "Create your first client to start issuing licenses and restaurants."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Restaurants</TableHead>
                    <TableHead className="text-center">Licenses</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link href={`/admin/clients/${c.id}`} className="font-medium hover:text-primary">
                          {c.companyName}
                        </Link>
                        <p className="text-xs text-muted-foreground">{c.name}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{c.email}</p>
                        {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={c.status} />
                        {c.expiredLicenses > 0 && (
                          <p className="text-xs text-red-600 mt-1">
                            {c.expiredLicenses} expired license{c.expiredLicenses > 1 ? "s" : ""}
                          </p>
                        )}
                        {c.expiringLicenses > 0 && c.expiredLicenses === 0 && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            {c.expiringLicenses} expiring soon
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {c.restaurantCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                          {c.activeLicenses}/{c.licenseCount}
                          <span className="text-xs text-muted-foreground">active</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fmtDate(c.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/clients/${c.id}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
                          aria-label={`View ${c.companyName}`}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {result.total > 0 && (
        <UrlPagination page={result.page} pageSize={result.pageSize} total={result.total} />
      )}
    </>
  );
}
