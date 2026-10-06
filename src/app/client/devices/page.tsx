import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader, EmptyState } from "@/components/shared/table-kit";
import { requireClientPage } from "@/lib/auth/guards";
import { getClientDevicesScoped } from "@/lib/services/restaurants";
import { fmtDate, fmtDateTime, formatOsInfo } from "@/lib/format";
import { MonitorSmartphone } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClientDevicesPage() {
  const user = await requireClientPage();
  const devices = await getClientDevicesScoped(user.clientId!);

  return (
    <>
      <PageHeader
        title="Devices"
        description="POS terminals activated across your restaurants. Contact support to reset a device."
      />

      {devices.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<MonitorSmartphone className="h-6 w-6 text-muted-foreground" />}
              title="No devices activated"
              description="Activate the CafeFlow POS with your license key — the terminal will appear here."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {devices.map((d) => (
            <Card key={d.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{d.deviceName ?? d.deviceIdentifier}</p>
                    <code className="text-xs text-muted-foreground block mt-0.5">{d.deviceIdentifier}</code>
                  </div>
                  <StatusBadge status={d.status} />
                </div>

                <div className="mt-4 space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Restaurant</span>
                    <Link href={`/client/restaurants/${d.restaurant.id ?? ""}`} className="font-medium hover:text-primary truncate max-w-[160px]">
                      {d.restaurant.name}
                    </Link>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">License</span>
                    <code className="text-xs">{d.license.licenseKey}</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">OS</span>
                    <span className="text-xs">{formatOsInfo(d.osInfo)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Activated</span>
                    <span>{fmtDate(d.activatedAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last seen</span>
                    <span className="text-xs">{d.lastSeenAt ? fmtDateTime(d.lastSeenAt) : "Never"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
