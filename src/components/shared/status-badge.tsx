import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  PauseCircle,
  Clock,
  CircleDashed,
  MonitorSmartphone,
} from "lucide-react";

const MAP: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  // clients / restaurants
  ACTIVE: { label: "Active", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  SUSPENDED: { label: "Suspended", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", icon: <PauseCircle className="h-3.5 w-3.5" /> },
  DEACTIVATED: { label: "Deactivated", cls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300", icon: <XCircle className="h-3.5 w-3.5" /> },
  // licenses
  PENDING: { label: "Pending", cls: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300", icon: <Clock className="h-3.5 w-3.5" /> },
  EXPIRED: { label: "Expired", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300", icon: <XCircle className="h-3.5 w-3.5" /> },
  REVOKED: { label: "Revoked", cls: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200", icon: <XCircle className="h-3.5 w-3.5" /> },
  EXPIRING_SOON: { label: "Expiring soon", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  NONE: { label: "No license", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400", icon: <CircleDashed className="h-3.5 w-3.5" /> },
  // devices
  BLOCKED: { label: "Blocked", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300", icon: <XCircle className="h-3.5 w-3.5" /> },
  // orders
  COMPLETED: { label: "Completed", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  REFUNDED: { label: "Refunded", cls: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300", icon: <PauseCircle className="h-3.5 w-3.5" /> },
  CANCELLED: { label: "Cancelled", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400", icon: <XCircle className="h-3.5 w-3.5" /> },
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash", CARD: "Card", MOBILE: "Mobile wallet", OTHER: "Other",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const conf = MAP[status] ?? { label: status, cls: "bg-zinc-100 text-zinc-600", icon: <CircleDashed className="h-3.5 w-3.5" /> };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        conf.cls,
        className
      )}
    >
      {conf.icon}
      {conf.label}
    </span>
  );
}

export function PaymentBadge({ method }: { method: string | null | undefined }) {
  if (!method) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-foreground whitespace-nowrap">
      <MonitorSmartphone className="h-3 w-3 text-muted-foreground" />
      {METHOD_LABELS[method] ?? method}
    </span>
  );
}
