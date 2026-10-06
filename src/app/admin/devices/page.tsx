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
import { DeviceRowActions } from "@/components/admin/device-actions";
import { listDevices } from "@/lib/services/restaurants";
import { formatNumber, fmtDate, fmtDateTime, formatOsInfo } from "@/lib/format";
import { MonitorSmartphone } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function AdminDevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const result = await listDevices({
    page,
    pageSize: PAGE_SIZE,
    search: sp.q,
    status: sp.status,
  });

  return (
    <>
      <PageHeader
        title="Devices"
        description={`${formatNumber(result.total)} activated POS terminals. Reset a device after a Windows reinstall to free its license slot.`}
      />

      <Suspense>
        <FilterToolbar
          searchPlaceholder="Search by device ID or name…"
          filters={[
            {
              key: "status",
              placeholder: "All statuses",
              options: [
                { value: "ACTIVE", label: "Active" },
                { value: "BLOCKED", label: "Blocked" },
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
              icon={<MonitorSmartphone className="h-6 w-6 text-muted-foreground" />}
              title="No devices found"
              description="Devices appear here after a POS terminal activates with a license key."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>License</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Activated</TableHead>
                    <TableHead>Last seen</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <p className="text-sm font-medium">{d.deviceName ?? d.deviceIdentifier}</p>
                        <code className="text-xs text-muted-foreground">{d.deviceIdentifier}</code>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{d.restaurantName}</p>
                        <p className="text-xs text-muted-foreground">{d.clientName}</p>
                      </TableCell>
                      <TableCell><code className="text-xs">{d.licenseKey}</code></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatOsInfo(d.osInfo)}
                        {d.appVersion && <p>App v{d.appVersion}</p>}
                      </TableCell>
                      <TableCell><StatusBadge status={d.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(d.activatedAt)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {d.lastSeenAt ? fmtDateTime(d.lastSeenAt) : "Never"}
                      </TableCell>
                      <TableCell>
                        <DeviceRowActions
                          deviceId={d.id}
                          identifier={d.deviceIdentifier}
                          status={d.status}
                          restaurantName={d.restaurantName}
                        />
                      </TableCell>
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
