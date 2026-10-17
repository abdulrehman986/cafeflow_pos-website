"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Option {
  value: string;
  label: string;
}

/**
 * URL-driven search + filter toolbar. Keeps list pages server-rendered while
 * still giving instant-feeling search (debounced, updates searchParams).
 */
export function FilterToolbar({
  searchPlaceholder = "Search…",
  filters = [],
}: {
  searchPlaceholder?: string;
  filters?: Array<{ key: string; placeholder: string; options: Option[] }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  // Debounced search → URL
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q) next.set("q", q);
      else next.delete("q");
      next.delete("page");
      if (next.toString() !== params.toString()) {
        router.replace(`${pathname}?${next.toString()}`);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "ALL") next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  }

  const hasActive = params.get("q") || filters.some((f) => params.get(f.key));

  return (
    <div className="flex flex-col sm:flex-row gap-2.5">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
          aria-label="Search"
        />
      </div>
      {filters.map((f) => (
        <Select
          key={f.key}
          value={params.get(f.key) ?? "ALL"}
          onValueChange={(v) => setFilter(f.key, v)}
        >
          <SelectTrigger className="w-full sm:w-[170px]" aria-label={f.placeholder}>
            <SelectValue placeholder={f.placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{f.placeholder}</SelectItem>
            {f.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {hasActive && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => {
            setQ("");
            router.replace(pathname);
          }}
        >
          <X className="h-4 w-4" /> Clear
        </Button>
      )}
    </div>
  );
}

/** A single URL-driven select filter, without the search box — for pages
 *  that have nothing to text-search but still need e.g. a restaurant picker. */
export function SelectFilter({
  filterKey,
  placeholder,
  options,
  className = "w-full sm:w-[220px]",
}: {
  filterKey: string;
  placeholder: string;
  options: Option[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setFilter(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "ALL") next.set(filterKey, value);
    else next.delete(filterKey);
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <Select value={params.get(filterKey) ?? "ALL"} onValueChange={setFilter}>
      <SelectTrigger className={className} aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Pagination for server-rendered tables — pushes page into the URL. */
export function UrlPagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function go(p: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => go(page - 1)}>
          Previous
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          Page {page} / {pages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => go(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
