import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { PageHeader } from "@/components/shared/table-kit";
import { ClientStatusActions, ClientDeleteButton } from "@/components/admin/client-actions";
import { getClientDetail } from "@/lib/services/clients";
import { formatRs, formatNumber, fmtDate, fmtDateTime } from "@/lib/format";
import { licenseEffectiveStatus } from "@/lib/license-key";
import {
  Banknote,
  Store,
  KeyRound,
  MonitorSmartphone,
  Building2,
  ArrowRight,
  TrendingUp,
  Mail,
  Phone,
  CalendarDays,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getClientDetail(id);
  if (!detail) notFound();

  const { client, restaurants, devices, salesSummary, accounts } = detail;

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/clients" className="hover:text-foreground">Clients</Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate">{client.companyName}</span>
      </div>

      <PageHeader
        title={client.companyName}
        description={`Client since ${fmtDate(client.createdAt)}`}
        actions={
          <>
            <ClientStatusActions clientId={client.id} status={client.status} name={client.companyName} />
            <ClientDeleteButton
              clientId={client.id}
              name={client.companyName}
              hasRestaurants={restaurants.length > 0}
            />
          </>
        }
      />

      {/* Contact card */}
      <Card>
        <CardContent className="p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-3">
              <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium truncate">{client.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="text-sm font-medium">{client.phone ?? "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Contact person</p>
                <p className="text-sm font-medium">{client.name}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CalendarDays className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Status</p>
                <StatusBadge status={client.status} />
              </div>
            </div>
          </div>
          {client.notes && (
            <p className="mt-4 pt-4 border-t text-sm text-muted-foreground">{client.notes}</p>
          )}
        </CardContent>
      </Card>

      {/* Sales summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Today's sales" value={formatRs(salesSummary.today)} icon={Banknote} tone="positive" />
        <StatCard title="This month" value={formatRs(salesSummary.month)} icon={TrendingUp} />
        <StatCard title="Last 30 days" value={formatRs(salesSummary.last30)} icon={TrendingUp} />
        <StatCard
          title="Lifetime synced sales"
          value={formatRs(salesSummary.total)}
          sub={`${formatNumber(salesSummary.orderCount)} records`}
          icon={Store}
        />
      </div>

      {/* Restaurants */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Restaurants ({restaurants.length})</CardTitle>
              <CardDescription>Each location is an isolated workspace</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/restaurants?clientId=${client.id}`}>
                Manage <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {restaurants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center px-6">
              No restaurants yet — create one from the Restaurants page.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>License</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-center">Devices</TableHead>
                    <TableHead className="text-right">Today</TableHead>
                    <TableHead className="text-right">This month</TableHead>
                    <TableHead>Last sync</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {restaurants.map((r) => {
                    const eff = r.license
                      ? licenseEffectiveStatus({ status: r.license.status, expiresAt: r.license.expiresAt })
                      : null;
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Link href={`/admin/restaurants?q=${encodeURIComponent(r.name)}`} className="font-medium hover:text-primary">
                            {r.name}
                          </Link>
                          {r.city && <p className="text-xs text-muted-foreground">{r.city}</p>}
                        </TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                        <TableCell>
                          {r.license ? (
                            <>
                              <code className="text-xs">{r.license.licenseKey}</code>
                              <div className="mt-1"><StatusBadge status={eff!.effectiveStatus} /></div>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">No license</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.license ? (
                            <>
                              {fmtDate(r.license.expiresAt)}
                              <p className="text-xs text-muted-foreground">{eff!.daysRemaining} days left</p>
                            </>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-center text-sm tabular-nums">
                          {r.activeDevices}/{r.license?.maxDevices ?? 0}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{formatRs(r.todaySales)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{formatRs(r.monthSales)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.lastSyncAt ? fmtDateTime(r.lastSyncAt) : "Never"}
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

      {/* Devices + login accounts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Devices ({devices.length})</CardTitle>
                <CardDescription>Activated POS terminals</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/devices?q=`}>
                  <MonitorSmartphone className="h-4 w-4" /> All devices
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {devices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center px-6">
                No POS terminals activated yet.
              </p>
            ) : (
              <div className="divide-y max-h-96 overflow-y-auto">
                {devices.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-5 py-3">
                    <MonitorSmartphone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{d.deviceName ?? d.deviceIdentifier}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {d.restaurant} · {d.deviceIdentifier}
                      </p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={d.status} />
                      <p className="text-xs text-muted-foreground mt-1">
                        {d.lastSeenAt ? `Seen ${fmtDateTime(d.lastSeenAt)}` : "Never seen"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Login accounts ({accounts.length})</CardTitle>
            <CardDescription>Profiles linked to this client</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center px-6">
                No login accounts linked.
              </p>
            ) : (
              <div className="divide-y">
                {accounts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={a.isActive ? "ACTIVE" : "SUSPENDED"} />
                      <p className="text-xs text-muted-foreground mt-1">
                        {a.lastLoginAt ? `Last login ${fmtDateTime(a.lastLoginAt)}` : "Never logged in"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
