"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Menu, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#offline", label: "Offline-first" },
  { href: "#multi-restaurant", label: "Multi-location" },
  { href: "#licensing", label: "Licensing" },
  { href: "#faq", label: "FAQ" },
  { href: "#contact", label: "Contact" },
];

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all border-b",
        scrolled
          ? "bg-background/95 backdrop-blur border-border shadow-sm"
          : "bg-transparent border-transparent"
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" aria-label="CafeFlow home">
            <BrandLogo />
          </Link>

          <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-1.5">
            <ThemeToggle />
            <Button asChild variant="outline" size="sm">
              <a href="#contact">Contact us</a>
            </Button>
            <Button asChild size="sm">
              <Link href="/login">
                Login <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle />
            <button
              className="lg:hidden rounded-md p-2 hover:bg-muted"
              onClick={() => setOpen(!open)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t bg-background">
          <nav className="mx-auto max-w-7xl px-4 py-3 space-y-1" aria-label="Mobile navigation">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                {l.label}
              </a>
            ))}
            <div className="flex gap-2 pt-2">
              <Button asChild variant="outline" className="flex-1">
                <a href="#contact" onClick={() => setOpen(false)}>Contact us</a>
              </Button>
              <Button asChild className="flex-1">
                <Link href="/login">Login</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
