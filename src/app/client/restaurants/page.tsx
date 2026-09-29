import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/shared/table-kit";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireClientPage } from "@/lib/auth/guards";
import { getClientOverview } from "@/lib/services/dashboard";
import { formatRs, formatNumber } from "@/lib/format";
import { Store, KeyRound, ArrowRight, MapPin, CalendarClock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClientRestaurantsPage() {
  const user = await requireClientPage();
  const overview = await getClientOverview(user.clientId!);

  return (
    <>
      <PageHeader
        title="My Restaurants"
        description={`All locations under your account — each with isolated data, licenses and devices.`}
      />

      {overview.restaurants.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Store className="h-6 w-6 text-muted-foreground" />}
              title="No restaurants yet"
              description="Your CafeFlow representative creates restaurants and issues licenses for your account."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {overview.restaurants.map((r) => (
            <Link key={r.id} href={`/client/restaurants/${r.id}`} className="group">
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" /> {r.city ?? "—"}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/40 px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">Today&apos;s sales</p>
                      <p className="text-sm font-bold tabular-nums">{formatRs(r.todaySales)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">Today&apos;s orders</p>
                      <p className="text-sm font-bold tabular-nums">{formatNumber(r.todayOrders)}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border px-3.5 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <KeyRound className="h-3.5 w-3.5" /> License
                      </span>
                      <StatusBadge status={r.licenseStatus} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {r.licenseExpiresAt
                          ? r.licenseStatus === "EXPIRED"
                            ? "Expired"
                            : `${r.licenseDaysRemaining} days remaining`
                          : "No license issued"}
                      </span>
                      <span className="text-primary font-medium flex items-center group-hover:gap-2 transition-all">
                        Open <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
