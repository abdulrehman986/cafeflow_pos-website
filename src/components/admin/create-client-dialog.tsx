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
import { Loader2, Plus, UserPlus, Copy, Check } from "lucide-react";

interface ClientFormValues {
  name: string;
  email: string;
  phone: string;
  companyName: string;
  notes: string;
}

const EMPTY: ClientFormValues = { name: "", email: "", phone: "", companyName: "", notes: "" };

export function CreateClientDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<ClientFormValues>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function set<K extends keyof ClientFormValues>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
    navigator.clipboard.writeText(`Email: ${created.email}\nTemporary password: ${created.temporaryPassword}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function close() {
    setOpen(false);
    setValues(EMPTY);
    setCreated(null);
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Add client
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" /> Client created
              </DialogTitle>
              <DialogDescription>
                Share these one-time credentials with the client — the temporary password will
                not be shown again.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Login email</p>
                <p className="text-sm font-medium font-mono">{created.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Temporary password</p>
                <p className="text-sm font-medium font-mono">{created.temporaryPassword}</p>
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
                Creates the business account and its login. A temporary password is generated
                server-side.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-300">
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
                  <Label htmlFor="cc-email">Email</Label>
                  <Input id="cc-email" type="email" value={values.email} onChange={(e) => set("email", e.target.value)} placeholder="ahmed@business.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cc-phone">Phone (optional)</Label>
                  <Input id="cc-phone" value={values.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+92 300 1234567" />
                </div>
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
