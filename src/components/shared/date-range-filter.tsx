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

/** Preset range chips (7/30 days, this month). */
export function DatePresets() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function preset(days: number) {
    const next = new URLSearchParams(params.toString());
    const to = new Date();
    const from = new Date(to.getTime() - days * 86400000);
    next.set("from", from.toISOString().slice(0, 10));
    next.set("to", to.toISOString().slice(0, 10));
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  }

  const active = (days: number) => {
    const from = params.get("from");
    const to = params.get("to");
    if (!from || !to) return false;
    const diff = (new Date(to).getTime() - new Date(from).getTime()) / 86400000;
    return Math.abs(diff - days) < 1.5 && new Date(to).toDateString() === new Date().toDateString();
  };

  return (
    <div className="flex flex-wrap gap-2">
      {[7, 30, 90].map((d) => (
        <Button
          key={d}
          size="sm"
          variant={active(d) ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={() => preset(d)}
        >
          Last {d} days
        </Button>
      ))}
    </div>
  );
}
