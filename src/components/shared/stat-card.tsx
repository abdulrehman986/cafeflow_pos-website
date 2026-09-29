import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: "default" | "positive" | "warning" | "danger" | "info";
  href?: string;
}

const TONES = {
  default: "text-foreground",
  positive: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
  info: "text-teal-600 dark:text-teal-400",
};

const ICON_BGS = {
  default: "bg-muted text-foreground",
  positive: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  warning: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  danger: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
  info: "bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400",
};

export function StatCard({ title, value, sub, icon: Icon, tone = "default" }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground font-medium truncate">{title}</p>
            <p className={cn("text-2xl font-bold tracking-tight mt-1.5 tabular-nums", TONES[tone])}>
              {value}
            </p>
            {sub && <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>}
          </div>
          <div className={cn("rounded-lg p-2.5 shrink-0", ICON_BGS[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
