import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader, EmptyState } from "@/components/shared/table-kit";
import { requireClientPage } from "@/lib/auth/guards";
import { getClientLicensesScoped } from "@/lib/services/restaurants";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { licenseEffectiveStatus } from "@/lib/license-key";
import { KeyRound, MonitorSmartphone, Store, CalendarClock, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClientLicensesPage() {
  const user = await requireClientPage();
  const licenses = await getClientLicensesScoped(user.clientId!);

  return (
    <>
      <PageHeader
        title="Licenses"
        description="Your restaurant licenses, devices and expiry status."
      />

      {licenses.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<KeyRound className="h-6 w-6 text-muted-foreground" />}
              title="No licenses yet"
              description="Licenses are issued by CafeFlow for each of your restaurants."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {licenses.map((license) => {
            const eff = licenseEffectiveStatus(license);
            const activeDevices = license.devices.filter((d) => d.status === "ACTIVE");
            return (
              <Card key={license.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Store className="h-4 w-4 text-muted-foreground" />
                        {license.restaurant.name}
                      </CardTitle>
                      <CardDescription>{license.restaurant.city ?? "—"}</CardDescription>
                    </div>
                    <StatusBadge status={eff.effectiveStatus} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl bg-muted/50 px-4 py-3.5 text-center">
                    <code className="text-lg font-bold tracking-widest">{license.licenseKey}</code>
                    <p className="text-xs text-muted-foreground mt-1">
                      Use this key in the CafeFlow POS activation screen
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border px-3.5 py-2.5">
                      <p className="text-xs text-muted-foreground">Activation date</p>
                      <p className="font-medium mt-0.5">{fmtDate(license.activatedAt)}</p>
                    </div>
                    <div className="rounded-lg border px-3.5 py-2.5">
                      <p className="text-xs text-muted-foreground">Expiry date</p>
                      <p className={`font-medium mt-0.5 ${eff.daysRemaining <= 30 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                        {fmtDate(license.expiresAt)}
                      </p>
                    </div>
                    <div className="rounded-lg border px-3.5 py-2.5">
                      <p className="text-xs text-muted-foreground">Days remaining</p>
                      <p className={`font-medium mt-0.5 ${eff.daysRemaining <= 30 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                        {eff.daysRemaining} days
                      </p>
                    </div>
                    <div className="rounded-lg border px-3.5 py-2.5">
                      <p className="text-xs text-muted-foreground">Maximum devices</p>
                      <p className="font-medium mt-0.5">
                        {activeDevices.length}/{license.maxDevices} active
                      </p>
                    </div>
                    <div className="rounded-lg border px-3.5 py-2.5 col-span-2">
                      <p className="text-xs text-muted-foreground">Last verification</p>
                      <p className="font-medium mt-0.5 flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                        {license.lastVerifiedAt ? fmtDateTime(license.lastVerifiedAt) : "Never verified"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <MonitorSmartphone className="h-3.5 w-3.5" /> Active devices
                    </p>
                    {activeDevices.length === 0 ? (
                      <p className="text-sm text-muted-foreground rounded-lg border border-dashed px-3.5 py-2.5">
                        No POS terminal activated yet — activate with your license key.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {activeDevices.map((d) => (
                          <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3.5 py-2.5">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{d.deviceName ?? d.deviceIdentifier}</p>
                              <code className="text-xs text-muted-foreground">{d.deviceIdentifier}</code>
                            </div>
                            <p className="text-xs text-muted-foreground shrink-0">
                              {d.lastSeenAt ? fmtDate(d.lastSeenAt) : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {eff.effectiveStatus === "EXPIRING_SOON" && (
                    <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/40 dark:border-amber-500/25 rounded-lg px-3.5 py-2.5 flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 shrink-0" />
                      Your license expires in {eff.daysRemaining} days. Contact support to renew.
                    </p>
                  )}
                  {eff.effectiveStatus === "EXPIRED" && (
                    <p className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-lg px-3.5 py-2.5">
                      This license has expired. Contact support to renew it.
                    </p>
                  )}

                  <div className="pt-1">
                    <Link
                      href={`/client/restaurants/${license.restaurant.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      Open {license.restaurant.name} dashboard →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
