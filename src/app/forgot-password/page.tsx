"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ArrowLeft, Loader2, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? "Request failed.");
        return;
      }
      setSent(json.data.resetToken ?? "sent");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md mx-auto">
        <div className="flex justify-center mb-6">
          <BrandLogo size="lg" />
        </div>
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Reset your password</CardTitle>
            <CardDescription>
              Enter your account email and we&apos;ll send a secure reset link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent === null ? (
              <form onSubmit={onSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-300">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@business.com"
                      className="pl-9"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Send reset link
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950 px-3.5 py-3 text-sm text-emerald-800 dark:text-emerald-300">
                  If an account exists for <strong>{email}</strong>, a reset link has been created.
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This deployment does not send outbound email, so your one-time reset token is
                  provided here. In production this arrives by email (Supabase Auth / SMTP provider).
                </p>
                {sent !== "sent" && (
                  <div className="rounded-lg border bg-muted/50 p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Reset token</p>
                    <code className="text-xs break-all">{sent}</code>
                  </div>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/reset-password?token=${encodeURIComponent(sent)}`)}
                >
                  Continue to reset form
                </Button>
              </div>
            )}
            <p className="mt-6 text-center text-xs text-muted-foreground">
              <Link href="/login" className="inline-flex items-center gap-1 hover:text-foreground">
                <ArrowLeft className="h-3 w-3" /> Back to sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
