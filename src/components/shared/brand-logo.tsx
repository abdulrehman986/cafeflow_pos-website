import { cn } from "@/lib/utils";
import { Coffee } from "lucide-react";

export function BrandLogo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10";
  const icon = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-6 w-6" : "h-5 w-5";
  const text = size === "sm" ? "text-lg" : size === "lg" ? "text-2xl" : "text-xl";
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          dims,
          "rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-sm"
        )}
      >
        <Coffee className={icon} />
      </div>
      <div className="leading-none">
        <span className={cn(text, "font-bold tracking-tight")}>
          Cafe<span className="text-primary">Flow</span>
        </span>
      </div>
    </div>
  );
}
