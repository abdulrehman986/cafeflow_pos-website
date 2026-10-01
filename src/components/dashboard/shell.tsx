"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { logout } from "@/components/shared/logout-action";
import {
  LayoutDashboard,
  Users,
  Store,
  KeyRound,
  MonitorSmartphone,
  BarChart3,
  Receipt,
  FileBarChart,
  Settings,
  Building2,
  UserRound,
  LogOut,
  Menu,
  ShieldCheck,
  BadgeCheck,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/restaurants", label: "Restaurants", icon: Store },
  { href: "/admin/licenses", label: "Licenses", icon: KeyRound },
  { href: "/admin/devices", label: "Devices", icon: MonitorSmartphone },
  { href: "/admin/sales", label: "Sales", icon: BarChart3 },
  { href: "/admin/orders", label: "Orders", icon: Receipt },
  { href: "/admin/reports", label: "Reports", icon: FileBarChart },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const CLIENT_NAV: NavItem[] = [
  { href: "/client", label: "Dashboard", icon: LayoutDashboard },
  { href: "/client/restaurants", label: "My Restaurants", icon: Building2 },
  { href: "/client/licenses", label: "Licenses", icon: KeyRound },
  { href: "/client/devices", label: "Devices", icon: MonitorSmartphone },
  { href: "/client/profile", label: "Profile", icon: UserRound },
];

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1" aria-label="Dashboard navigation">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/admin" && item.href !== "/client" && pathname.startsWith(item.href + "/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <item.icon className="h-4.5 w-4.5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardShell({
  variant,
  user,
  businessName,
  children,
}: {
  variant: "admin" | "client";
  user: { fullName: string; email: string };
  businessName?: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const nav = variant === "admin" ? ADMIN_NAV : CLIENT_NAV;
  const initials = user.fullName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function onLogout() {
    const res = await logout();
    if (res.success) {
      toast.success("Signed out");
      router.push("/login");
      router.refresh();
    }
  }

  function goTo(path: string) {
    router.push(path);
  }

  const userMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 px-2 gap-2.5 hover:bg-accent" aria-label="Account menu">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden md:block text-left leading-tight">
            <span className="block text-sm font-medium truncate max-w-[140px]">{user.fullName}</span>
            <span className="block text-xs text-muted-foreground truncate max-w-[140px]">{user.email}</span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="text-sm font-medium">{user.fullName}</p>
          <p className="text-xs text-muted-foreground font-normal">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => goTo(variant === "admin" ? "/admin/settings" : "/client/profile")}>
          {variant === "admin" ? <Settings className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
          {variant === "admin" ? "Settings" : "Profile"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout} variant="destructive">
          <LogOut className="h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r bg-card z-40">
        <div className="h-16 flex items-center px-5 border-b">
          <Link href={variant === "admin" ? "/admin" : "/client"} aria-label="CafeFlow dashboard">
            <BrandLogo size="sm" />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          {variant === "client" && businessName && (
            <div className="mb-4 rounded-lg border bg-muted/40 px-3 py-2.5">
              <p className="text-xs font-medium text-muted-foreground">Business</p>
              <p className="text-sm font-semibold truncate">{businessName}</p>
            </div>
          )}
          <NavLinks items={nav} />
        </div>
        <div className="p-3 border-t">
          <div
            className={cn(
              "rounded-lg px-3 py-2.5 flex items-center gap-2.5 text-xs",
              variant === "admin"
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {variant === "admin" ? <ShieldCheck className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />}
            {variant === "admin" ? "Super admin access" : "Client access"}
          </div>
        </div>
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="lg:hidden sticky top-0 z-40 flex h-16 items-center gap-3 border-b bg-card px-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-4">
            <SheetTitle>
              <BrandLogo size="sm" />
            </SheetTitle>
            <div className="mt-5">
              {variant === "client" && businessName && (
                <div className="mb-4 rounded-lg border bg-muted/40 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground font-medium">Business</p>
                  <p className="text-sm font-semibold truncate">{businessName}</p>
                </div>
              )}
              <NavLinks items={nav} onNavigate={() => setMobileOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
        <BrandLogo size="sm" />
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {userMenu}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Desktop top bar */}
        <div className="hidden lg:flex h-16 items-center gap-4 border-b bg-card px-6 sticky top-0 z-30">
          <p className="text-sm text-muted-foreground">
            {variant === "admin" ? "Platform administration" : businessName ?? "Client dashboard"}
          </p>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            {userMenu}
          </div>
        </div>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
