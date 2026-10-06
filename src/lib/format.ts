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

/**
 * Stable, date-embedded shift reference shared by the web and the POS:
 * `SH-YYYYMMDD-XXXX` — UTC opening date (matches the app's UTC daily
 * aggregation) plus the last 4 alphanumeric chars of the local shift id,
 * so both apps derive the exact same code from synced data alone.
 */
export function shiftRef(localShiftId: string, openedAt: Date): string {
  const day = openedAt.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix =
    (localShiftId.replace(/[^A-Za-z0-9]/g, "").slice(-4) || "0000").toUpperCase();
  return `SH-${day}-${suffix}`;
}

/**
 * Professional OS label. POS versions before terminal attribution sent the
 * raw user-agent as osInfo — parse those into a clean label; newer values
 * (e.g. "Windows 11 (64-bit)") pass through untouched.
 */
export function formatOsInfo(os: string | null | undefined): string {
  if (!os) return "—";
  if (!/Mozilla\/|AppleWebKit|Gecko\/|Safari\//.test(os)) return os;
  const bitness = /Win64|x64|WOW64|arm64|aarch64/.test(os) ? "64-bit" : null;
  let platform = "Unknown OS";
  if (/Windows NT 10\.0/.test(os)) platform = "Windows 10/11";
  else if (/Windows/.test(os)) platform = "Windows";
  else if (/Android [\d.]+/.test(os)) platform = "Android";
  else if (/iPhone|iPad/.test(os)) platform = "iOS";
  else if (/Mac OS X/.test(os)) platform = "macOS";
  else if (/CrOS/.test(os)) platform = "ChromeOS";
  else if (/Linux/.test(os)) platform = "Linux";
  return bitness ? `${platform} · ${bitness}` : platform;
}
