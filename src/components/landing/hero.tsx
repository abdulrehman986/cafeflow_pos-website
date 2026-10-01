import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CloudUpload, WifiOff, ShieldCheck, Store } from "lucide-react";

/** Product visual: a stylized dashboard preview rendered with pure CSS/Tailwind. */
function DashboardPreview() {
  const bars = [42, 58, 50, 66, 60, 74, 68, 82, 76, 90, 84, 96];
  const days = ["17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28"];
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-3xl bg-primary/10 blur-2xl" aria-hidden="true" />
      <div className="relative rounded-2xl border bg-card shadow-xl overflow-hidden">
        {/* window bar */}
        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="ml-3 text-xs text-muted-foreground">app.cafeflow.app/client</span>
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-muted-foreground">Ahmed Restaurants · Lahore</p>
              <p className="text-sm font-semibold">Today, 28 Sep</p>
            </div>
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15 border-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 mr-1" />
              Synced 2 min ago
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-2.5 mb-4">
            {[
              { label: "Today's sales", value: "Rs. 85,000" },
              { label: "Orders", value: "412" },
              { label: "Avg. order", value: "Rs. 206" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border bg-background p-2.5">
                <p className="text-[10px] text-muted-foreground truncate">{s.label}</p>
                <p className="text-sm font-bold tabular-nums mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border bg-background p-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium">Sales — last 12 days</p>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <CloudUpload className="h-3 w-3" /> Auto-sync on
              </div>
            </div>
            <div className="flex items-end gap-1.5 h-28" aria-hidden="true">
              {bars.map((h, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end">
                  <div
                    className={`w-full rounded-t-sm ${i === bars.length - 1 ? "bg-primary" : "bg-primary/25"}`}
                    style={{ height: `${h}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-1.5 mt-1.5">
              {days.map((d) => (
                <span key={d} className="flex-1 text-center text-[8px] text-muted-foreground">
                  {d}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5">
            <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground">
              POS kept selling during today&apos;s 40-minute internet outage — 63 orders queued and synced.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-20">
      {/* subtle background texture — no heavy gradients */}
      <div
        className="absolute inset-0 -z-10 [background-image:radial-gradient(circle_at_1px_1px,--alpha(var(--color-border)/0.6)_1px,transparent_0)] [background-size:24px_24px]"
        aria-hidden="true"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Offline-first Windows POS · built with Tauri
            </div>

            <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl lg:text-[3.4rem] lg:leading-[1.08]">
              Powerful POS for Modern{" "}
              <span className="text-primary">Cafes &amp; Restaurants</span>
            </h1>

            <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0">
              Run your restaurant offline, keep your data locally, and sync your sales
              securely when you&apos;re online.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Button asChild size="lg" className="h-12 px-7 text-base">
                <Link href="/login">
                  Login <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-7 text-base">
                <a href="#contact">Contact us</a>
              </Button>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4 max-w-md mx-auto lg:mx-0">
              {[
                { icon: WifiOff, label: "100% offline", sub: "SQLite on your PC" },
                { icon: ShieldCheck, label: "Secure sync", sub: "Encrypted HTTPS" },
                { icon: Store, label: "Multi-store", sub: "One account" },
              ].map((f) => (
                <div key={f.label} className="text-center lg:text-left">
                  <f.icon className="h-5 w-5 text-primary mx-auto lg:mx-0" />
                  <p className="mt-1.5 text-sm font-semibold">{f.label}</p>
                  <p className="text-xs text-muted-foreground">{f.sub}</p>
                </div>
              ))}
            </div>
          </div>

          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}
