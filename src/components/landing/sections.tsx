import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  WifiOff,
  BarChart3,
  Store,
  KeyRound,
  CloudUpload,
  ShieldCheck,
  MonitorSmartphone,
  Receipt,
  CheckCircle2,
  Lock,
  Server,
  RefreshCcw,
  Database,
  FileCheck2,
} from "lucide-react";

export function SectionHeading({
  eyebrow,
  title,
  description,
  center = true,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "text-center max-w-2xl mx-auto" : "max-w-2xl"}>
      <Badge
        variant="outline"
        className="text-primary border-primary/30 bg-primary/5"
      >
        {eyebrow}
      </Badge>
      <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}

export function FeaturesSection() {
  const features = [
    {
      icon: WifiOff,
      title: "Offline-first POS",
      desc: "Your tills never stop. CafeFlow runs entirely on local SQLite — take orders, print receipts and close the day with zero internet.",
    },
    {
      icon: BarChart3,
      title: "Sales dashboards",
      desc: "Daily, weekly, monthly and yearly revenue with order counts, average order value and payment-method breakdowns.",
    },
    {
      icon: Store,
      title: "Multi-restaurant support",
      desc: "Run 1 or 50 locations from one login. Every restaurant keeps strictly isolated data, licenses and devices.",
    },
    {
      icon: KeyRound,
      title: "License management",
      desc: "Securely generated keys with device limits, expiry tracking, suspension and instant revocation when needed.",
    },
    {
      icon: CloudUpload,
      title: "Cloud synchronization",
      desc: "When connectivity returns, pending sales sync over HTTPS — idempotent, so retries never duplicate records.",
    },
    {
      icon: Receipt,
      title: "Order management",
      desc: "Full order history with line items, discounts and tax — synced from the POS and searchable online.",
    },
    {
      icon: MonitorSmartphone,
      title: "Device tracking",
      desc: "See every activated POS terminal, its last-seen time and version. Reset devices remotely after reinstalls.",
    },
    {
      icon: FileCheck2,
      title: "Reports",
      desc: "Revenue by restaurant, by client and by payment method — the numbers owners actually ask for.",
    },
  ];

  return (
    <section id="features" className="py-16 sm:py-20 bg-muted/30 border-y">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Features"
          title="Everything a growing food business needs"
          description="The CafeFlow platform pairs an offline-capable desktop POS with a secure online back office for owners and administrators."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <Card key={f.title} className="border-border/60">
              <CardContent className="p-5">
                <div className="rounded-lg bg-primary/10 text-primary w-fit p-2.5">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export function OfflineSection() {
  return (
    <section id="offline" className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <SectionHeading
              center={false}
              eyebrow="Offline-first"
              title={
                <>
                  Internet down?
                  <br />
                  <span className="text-primary">Business as usual.</span>
                </>
              }
              description="CafeFlow's desktop POS stores every sale in a local SQLite database. The web platform never needs to be reachable for your tills to keep working — synchronization happens whenever connectivity returns."
            />
            <ul className="mt-6 space-y-3.5">
              {[
                "POS writes every order to local SQLite first — the cloud is optional",
                "Pending records queue up and sync in the background automatically",
                "Idempotent sync API: retries after network failures never duplicate a sale",
                "License grace period keeps verified installs running through outages",
              ].map((point) => (
                <li key={point} className="flex gap-3 items-start">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Sync flow diagram */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <p className="text-sm font-semibold mb-5">
              How synchronization works
            </p>
            <ol className="space-y-4">
              {[
                {
                  icon: Database,
                  title: "CafeFlow POS · local SQLite",
                  sub: "Orders, sales and inventory stored on the terminal",
                },
                {
                  icon: RefreshCcw,
                  title: "Pending sync queue",
                  sub: "Records tagged with unique local UUIDs while offline",
                },
                {
                  icon: Server,
                  title: "CafeFlow HTTPS API",
                  sub: "Device-token authentication + server-side validation",
                },
                {
                  icon: ShieldCheck,
                  title: "Cloud database",
                  sub: "Deduped by restaurant + local ID, then dashboards update",
                },
              ].map((step, i) => (
                <li key={step.title} className="flex gap-4 items-center">
                  <div className="relative">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
                      <step.icon className="h-5 w-5" />
                    </div>
                    {i < 3 && (
                      <span
                        className="absolute left-1/2 -translate-x-1/2 top-full h-4 w-px bg-border"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="text-xs text-muted-foreground">{step.sub}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

export function MultiRestaurantSection() {
  const restaurants = [
    {
      name: "Lahore Restaurant",
      city: "Lahore",
      sales: "Rs. 85,000",
      orders: 412,
      license: "Active · 18 months left",
    },
    {
      name: "Islamabad Restaurant",
      city: "Islamabad",
      sales: "Rs. 61,400",
      orders: 305,
      license: "Active · 24 months left",
    },
    {
      name: "Karachi Restaurant",
      city: "Karachi",
      sales: "Rs. 91,200",
      orders: 508,
      license: "Expiring in 12 days",
    },
  ];
  return (
    <section
      id="multi-restaurant"
      className="py-16 sm:py-20 bg-muted/30 border-y"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Multi-restaurant"
          title="One account. Every location. Zero data mixing."
          description="Each restaurant operates as a fully isolated workspace — its own license, devices, sales, orders and reports — while you monitor everything from a single dashboard."
        />
        <div className="mt-12 max-w-3xl mx-auto">
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3 pb-4 border-b">
              <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground grid place-items-center font-bold">
                AR
              </div>
              <div>
                <p className="font-semibold">Ahmed Restaurants</p>
                <p className="text-xs text-muted-foreground">
                  Client account · 3 restaurants
                </p>
              </div>
              <Badge className="ml-auto" variant="outline">
                Client dashboard
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {restaurants.map((r) => (
                <div
                  key={r.name}
                  className="rounded-xl border bg-background p-4"
                >
                  <p className="text-sm font-semibold truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.city}</p>
                  <div className="mt-3 space-y-1.5 text-xs">
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Today</span>
                      <span className="font-semibold tabular-nums">
                        {r.sales}
                      </span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Orders</span>
                      <span className="font-semibold tabular-nums">
                        {r.orders}
                      </span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">License</span>
                      <span
                        className={
                          r.license.includes("Expiring")
                            ? "text-amber-600 dark:text-amber-400 font-medium"
                            : "text-emerald-600 dark:text-emerald-400 font-medium"
                        }
                      >
                        {r.license}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground text-center">
              Data isolation is enforced server-side — restaurant data is only
              ever queried through ownership checks backed by database-level
              policies.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LicensingSection() {
  return (
    <section id="licensing" className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1">
            <SectionHeading
              center={false}
              eyebrow="Licensing"
              title="Licenses that respect real-world hardware"
              description="Keys are generated server-side with cryptographic randomness, bound to a restaurant, and limited by device count — with sensible recovery for reinstalls."
            />
            <ul className="mt-6 grid sm:grid-cols-2 gap-3.5">
              {[
                "Server-generated CF-XXXX-XXXX-XXXX keys",
                "Device limits per license (1–20 terminals)",
                "Suspend, revoke or extend anytime",
                "Admin can reset devices after a Windows reinstall",
                "Offline grace period prevents false lockouts",
                "Periodic license verification API for the POS",
              ].map((p) => (
                <li key={p} className="flex gap-2.5 items-start">
                  <CheckCircle2 className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="order-1 lg:order-2">
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
              <div className="border-b bg-muted/50 px-5 py-3 flex items-center justify-between">
                <p className="text-sm font-semibold">License details</p>
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0">
                  Active
                </Badge>
              </div>
              <div className="p-5 space-y-4">
                <div className="rounded-xl border bg-background p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1.5">
                    License key
                  </p>
                  <code className="text-lg font-bold tracking-widest">
                    CF-7K2M-9QF4-XR8T
                  </code>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Restaurant", "Lahore Restaurant"],
                    ["Expires", "28 September 2027"],
                    ["Max devices", "1 terminal"],
                    ["Device", "DESKTOP-ABC123"],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-muted/40 px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">{k}</p>
                      <p className="font-medium mt-0.5">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-dashed px-3.5 py-3 flex items-center gap-2.5">
                  <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    The server is the source of truth — the POS caches license
                    state locally and verifies periodically when online.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SecuritySection() {
  const items = [
    {
      icon: Lock,
      title: "Encrypted transport",
      desc: "All traffic — web and POS — over HTTPS with signed device tokens.",
    },
    {
      icon: ShieldCheck,
      title: "Row-level security",
      desc: "Database policies enforce that clients only ever touch their own restaurants' data.",
    },
    {
      icon: Server,
      title: "No secrets in clients",
      desc: "Service keys and secrets never leave the server; the POS holds only its device token.",
    },
    {
      icon: RefreshCcw,
      title: "Idempotent writes",
      desc: "Unique constraints on (restaurant, local ID) make duplicate syncs impossible.",
    },
    {
      icon: Database,
      title: "Validated input",
      desc: "Every API payload is schema-validated server-side before it reaches the database.",
    },
    {
      icon: MonitorSmartphone,
      title: "Rate limiting",
      desc: "Login, sync and activation endpoints are throttled against abuse.",
    },
  ];
  return (
    <section id="security" className="py-16 sm:py-20 bg-muted/30 border-y">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Security"
          title="Built like infrastructure, not a demo"
          description="Security is enforced on the server — never in the browser alone."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <div key={i.title} className="rounded-xl border bg-card p-5">
              <i.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-semibold">{i.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                {i.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
