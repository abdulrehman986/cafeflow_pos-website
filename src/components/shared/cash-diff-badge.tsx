import { cn } from "@/lib/utils";

/** Cash-drawer variance: green when balanced, red when over/short. */
export function CashDiffBadge({ value, className }: { value: number | null | undefined; className?: string }) {
  const diff = value ?? 0;
  const balanced = Math.abs(diff) < 0.005;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        balanced
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-red-500/10 text-red-600 dark:text-red-400",
        className
      )}
    >
      {balanced ? "Balanced" : `${diff > 0 ? "+" : ""}${diff.toFixed(2)}`}
    </span>
  );
}
