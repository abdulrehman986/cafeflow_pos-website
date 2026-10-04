import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster as Sonner } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CafeFlow — Powerful POS for Modern Cafes & Restaurants",
  description:
    "Run your restaurant offline, keep your data locally, and sync your sales securely when you're online. License management, multi-restaurant dashboards and cloud backup for the CafeFlow POS.",
  keywords: [
    "CafeFlow",
    "POS",
    "restaurant POS",
    "offline-first POS",
    "cafe management",
    "restaurant management",
    "license management",
  ],
  openGraph: {
    title: "CafeFlow — Powerful POS for Modern Cafes & Restaurants",
    description:
      "Offline-first restaurant POS with secure cloud sync, multi-restaurant management and licensing.",
    siteName: "CafeFlow",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {/* Light theme is the default; users can toggle to the dark (POS-style) theme. */}
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          {children}
          <Sonner position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
