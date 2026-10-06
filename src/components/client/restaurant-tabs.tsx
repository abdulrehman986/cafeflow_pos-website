import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Clock,
  LayoutDashboard,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type RestaurantTabKey = "dashboard" | "sales" | "orders" | "shifts";

const TABS: Array<{
  key: RestaurantTabKey;
  label: string;
  icon: React.ElementType;
  href: (restaurantId: string) => string;
}> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: (id) => `/client/restaurants/${id}` },
  { key: "sales", label: "Sales", icon: BarChart3, href: (id) => `/client/restaurants/${id}/sales` },
  { key: "orders", label: "Orders", icon: Receipt, href: (id) => `/client/restaurants/${id}/orders` },
  { key: "shifts", label: "Shifts", icon: Clock, href: (id) => `/client/restaurants/${id}/shifts` },
];

/**
 * Workspace navigation shared by every page of a restaurant: a back link to
 * My Restaurants plus the Dashboard / Sales / Orders / Shifts tabs, so staff
 * can move between a restaurant's screens from anywhere — not just from the
 * dashboard page.
 */
export function RestaurantTabs({
  restaurantId,
  active,
}: {
  restaurantId: string;
  active: RestaurantTabKey;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Link
        href="/client/restaurants"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> My Restaurants
      </Link>
      <nav
        className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1"
        aria-label="Restaurant sections"
      >
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={tab.href(restaurantId)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <tab.icon className="h-4 w-4" /> {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
