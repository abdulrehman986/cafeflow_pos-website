import { format, parseISO } from "date-fns";

/** Currency formatter — Pakistani Rupee, whole amounts (POS money is integer PKR). */
export function formatRs(amount: number | null | undefined): string {
  const value = amount ?? 0;
  return `Rs. ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(value)}`;
}

export function formatNumber(n: number | null | undefined): string {
  return new Intl.NumberFormat("en-PK").format(n ?? 0);
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, "d MMM yyyy");
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, "d MMM yyyy, h:mm a");
}

export function fmtTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, "h:mm a");
}

export function maskLicenseKey(key: string): string {
  // CF-XXXX-XXXX-XXXX → shown partially on list views
  if (key.length < 8) return key;
  return `${key.slice(0, 3)}-••••-••••-${key.slice(-4)}`;
}

export function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000);
}
