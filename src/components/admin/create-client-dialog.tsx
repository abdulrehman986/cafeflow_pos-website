"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2,
  Plus,
  UserPlus,
  Copy,
  Check,
  Eye,
  EyeOff,
  Dices,
  KeyRound,
} from "lucide-react";

interface ClientFormValues {
  name: string;
  email: string;
  phone: string;
  companyName: string;
  notes: string;
  password: string;
  confirmPassword: string;
}

const EMPTY: ClientFormValues = {
  name: "",
  email: "",
  phone: "",
  companyName: "",
  notes: "",
  password: "",
  confirmPassword: "",
};

/** Client-side strong password generator (mirrors the server-side policy). */
function generateStrongPassword(): string {
  const words = ["Chai", "Biryani", "Kebab", "Karahi", "Paratha", "Falooda", "Lassi", "Samosa"];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(10 + Math.random() * 90);
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)];
  const symbol = "!@#$%&*"[Math.floor(Math.random() * 7)];
  return `${word}${num}${upper}${symbol}`;
}

/** 0–3 strength score: length, letters+digits mix, symbol/extra length. */
function passwordStrength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (/[A-Za-z]/.test(pw) && /[0-9]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) score += 1;
  return Math.min(3, score);
}

const STRENGTH_LABELS = ["", "Weak", "Fair", "Strong"];
const STRENGTH_COLORS = ["", "bg-red-400", "bg-amber-400", "bg-emerald-400"];

export function CreateClientDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<ClientFormValues>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function set<K extends keyof ClientFormValues>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function fillGeneratedPassword() {
    const pw = generateStrongPassword();
    setValues((v) => ({ ...v, password: pw, confirmPassword: pw }));
    setShowPassword(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (values.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!/[A-Za-z]/.test(values.password) || !/[0-9]/.test(values.password)) {
      setError("Password must contain at least one letter and one number.");
      return;
    }
    if (values.password !== values.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          phone: values.phone || undefined,
          companyName: values.companyName,
          notes: values.notes || undefined,
          password: values.password,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? "Could not create client.");
        return;
      }
      setCreated(json.data.account);
      toast.success(`Client "${json.data.client.companyName}" created`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function copyCredentials() {
    if (!created) return;
    navigator.clipboard.writeText(`Email: ${created.email}\nPassword: ${created.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function close() {
    setOpen(false);
    setValues(EMPTY);
    setCreated(null);
    setError(null);
    setShowPassword(false);
  }

  const strength = passwordStrength(values.password);

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Add client
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" /> Client created
              </DialogTitle>
              <DialogDescription>
                The user can sign in immediately with the credentials below, and change the
                password anytime from their profile.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Login email</p>
                <p className="text-sm font-medium font-mono">{created.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Password</p>
                <p className="text-sm font-medium font-mono">{created.password}</p>
              </div>
              <Button variant="outline" size="sm" onClick={copyCredentials} className="w-full">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied to clipboard" : "Copy credentials"}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add a new client</DialogTitle>
              <DialogDescription>
                Creates the business account and its login credentials — set the email and
                password the user will use to sign in.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cc-name">Contact name</Label>
                  <Input id="cc-name" value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="Ahmed Raza" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cc-company">Business name</Label>
                  <Input id="cc-company" value={values.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Ahmed Restaurants" required />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cc-email">Email (used to log in)</Label>
                  <Input id="cc-email" type="email" value={values.email} onChange={(e) => set("email", e.target.value)} placeholder="ahmed@business.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cc-phone">Phone (optional)</Label>
                  <Input id="cc-phone" value={values.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+92 300 1234567" />
                </div>
              </div>

              <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <KeyRound className="h-4 w-4 text-primary" /> Login credentials
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="cc-password">Password</Label>
                    <button
                      type="button"
                      onClick={fillGeneratedPassword}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <Dices className="h-3.5 w-3.5" /> Generate strong password
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="cc-password"
                      type={showPassword ? "text" : "password"}
                      value={values.password}
                      onChange={(e) => set("password", e.target.value)}
                      placeholder="At least 8 characters, letters + numbers"
                      className="pr-20"
                      required
                      autoComplete="new-password"
                    />
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center">
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  {values.password && (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 flex-1" aria-hidden="true">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i <= strength ? STRENGTH_COLORS[strength] : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] text-muted-foreground w-12 text-right">
                        {STRENGTH_LABELS[strength]}
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cc-confirm">Confirm password</Label>
                  <div className="relative">
                    <Input
                      id="cc-confirm"
                      type={showPassword ? "text" : "password"}
                      value={values.confirmPassword}
                      onChange={(e) => set("confirmPassword", e.target.value)}
                      placeholder="Re-enter the password"
                      className={cnConfirm(values.password, values.confirmPassword)}
                      required
                      autoComplete="new-password"
                    />
                    {values.confirmPassword && values.confirmPassword === values.password && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Minimum 8 characters with at least one letter and one number. The password is
                  stored as a bcrypt hash — it is shown once here so you can hand it over.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cc-notes">Internal notes (optional)</Label>
                <Textarea id="cc-notes" value={values.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Prefers WhatsApp, 3 locations planned…" rows={2} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={close}>Cancel</Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />} Create client
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Confirm input border feedback: amber while typing, green on match, red on mismatch. */
function cnConfirm(password: string, confirm: string): string {
  if (!confirm) return "";
  if (confirm === password) return "border-emerald-500/50 focus-visible:ring-emerald-500/40";
  return "border-red-500/50 focus-visible:ring-red-500/40";
}
