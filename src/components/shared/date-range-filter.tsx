"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CalendarRange, X } from "lucide-react";

/** URL-driven date range filter (from / to ISO dates). */
export function DateRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");

  function apply() {
    const next = new URLSearchParams(params.toString());
    if (from) next.set("from", from);
    else next.delete("from");
    if (to) next.set("to", to);
    else next.delete("to");
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  }

  function clear() {
    const next = new URLSearchParams(params.toString());
    next.delete("from");
    next.delete("to");
    next.delete("page");
    setFrom("");
    setTo("");
    router.replace(`${pathname}?${next.toString()}`);
  }

  const hasRange = params.get("from") || params.get("to");

  return (
    <div className="flex flex-wrap items-end gap-2.5">
      <div className="space-y-1.5">
        <Label htmlFor="dr-from" className="text-xs text-muted-foreground">From</Label>
        <Input
          id="dr-from"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-9 w-[150px]"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dr-to" className="text-xs text-muted-foreground">To</Label>
        <Input
          id="dr-to"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-9 w-[150px]"
        />
      </div>
      <Button size="sm" variant="outline" className="h-9" onClick={apply}>
        <CalendarRange className="h-4 w-4" /> Apply
      </Button>
      {hasRange && (
        <Button size="sm" variant="ghost" className="h-9 text-muted-foreground" onClick={clear}>
          <X className="h-4 w-4" /> Clear
        </Button>
      )}
    </div>
  );
}

/** Preset range chips — UTC-aligned with the server's day boundaries. */
export function DatePresets() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const utcToday = () => {
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  };

  const PRESETS: Array<{ key: string; label: string; range: () => [Date, Date] }> = [
    { key: "today", label: "Today", range: () => { const t = utcToday(); return [t, t]; } },
    { key: "yesterday", label: "Yesterday", range: () => { const y = new Date(utcToday().getTime() - 86400000); return [y, y]; } },
    { key: "7d", label: "Last 7 days", range: () => { const t = utcToday(); return [new Date(t.getTime() - 6 * 86400000), t]; } },
    { key: "30d", label: "Last 30 days", range: () => { const t = utcToday(); return [new Date(t.getTime() - 29 * 86400000), t]; } },
    { key: "90d", label: "Last 90 days", range: () => { const t = utcToday(); return [new Date(t.getTime() - 89 * 86400000), t]; } },
    { key: "month", label: "This month", range: () => { const n = new Date(); return [new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)), utcToday()]; } },
    { key: "year", label: "This year", range: () => { const n = new Date(); return [new Date(Date.UTC(n.getUTCFullYear(), 0, 1)), utcToday()]; } },
  ];

  function apply(key: string) {
    const p = PRESETS.find((x) => x.key === key);
    if (!p) return;
    const [from, to] = p.range();
    const next = new URLSearchParams(params.toString());
    next.set("from", iso(from));
    next.set("to", iso(to));
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((p) => {
        const [from, to] = p.range();
        const active =
          params.get("from") === iso(from) && params.get("to") === iso(to);
        return (
          <Button
            key={p.key}
            size="sm"
            variant={active ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => apply(p.key)}
          >
            {p.label}
          </Button>
        );
      })}
    </div>
  );
}
