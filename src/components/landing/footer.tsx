import Link from "next/link";
import { BrandLogo } from "@/components/shared/brand-logo";

export function LandingFooter() {
  return (
    <footer className="border-t bg-muted/30 mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <BrandLogo />
            <p className="mt-4 text-sm text-muted-foreground max-w-sm leading-relaxed">
              Offline-first POS and online management platform for restaurants, cafes and
              food businesses. Run your restaurant offline, sync securely when online.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold mb-3.5">Product</p>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><a className="hover:text-foreground" href="#features">Features</a></li>
              <li><a className="hover:text-foreground" href="#offline">Offline-first</a></li>
              <li><a className="hover:text-foreground" href="#multi-restaurant">Multi-restaurant</a></li>
              <li><a className="hover:text-foreground" href="#licensing">Licensing</a></li>
              <li><a className="hover:text-foreground" href="#faq">FAQ</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold mb-3.5">Company</p>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><a className="hover:text-foreground" href="#contact">Contact</a></li>
              <li><Link className="hover:text-foreground" href="/login">Client login</Link></li>
              <li><a className="hover:text-foreground" href="mailto:support@cafeflow.app">support@cafeflow.app</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} CafeFlow. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            POS for Windows · Built with Tauri, React, Rust &amp; SQLite
          </p>
        </div>
      </div>
    </footer>
  );
}
