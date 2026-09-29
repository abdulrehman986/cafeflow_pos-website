"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Check, Copy } from "lucide-react";

interface ClientOption { id: string; companyName: string }

export function CreateRestaurantDialog({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [issueLicense, setIssueLicense] = useState(true);
  const [months, setMonths] = useState("12");
  const [maxDevices, setMaxDevices] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ restaurant: string; licenseKey?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && !clientId && clients.length > 0) setClientId(clients[0].id);
  }, [open, clientId, clients]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          name,
          city: city || undefined,
          phone: phone || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? "Could not create restaurant.");
        return;
      }

      let licenseKey: string | undefined;
      if (issueLicense) {
        const licRes = await fetch("/api/admin/licenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurantId: json.data.restaurant.id,
            expiresInMonths: parseInt(months, 10),
            maxDevices: parseInt(maxDevices, 10),
          }),
        });
        const licJson = await licRes.json();
        if (licJson.success) licenseKey = licJson.data.license.licenseKey;
      }

      setCreated({ restaurant: name, licenseKey });
      toast.success(`Restaurant "${name}" created${licenseKey ? " with license" : ""}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setOpen(false);
    setName(""); setCity(""); setPhone("");
    setIssueLicense(true); setMonths("12"); setMaxDevices("1");
    setCreated(null); setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> Add restaurant</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Restaurant created</DialogTitle>
              <DialogDescription>
                {created.licenseKey
                  ? "Share this license key with the client for POS activation."
                  : "You can generate a license later from the Licenses page."}
              </DialogDescription>
            </DialogHeader>
            {created.licenseKey && (
              <div className="rounded-lg border bg-muted/40 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1.5">License key</p>
                <code className="text-lg font-bold tracking-widest">{created.licenseKey}</code>
                <Button
                  variant="outline" size="sm" className="mt-3 w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(created.licenseKey!);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy key"}
                </Button>
              </div>
            )}
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add a restaurant</DialogTitle>
              <DialogDescription>
                A restaurant is an isolated workspace under a client, with its own license,
                devices and data.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label>Owner client</Label>
                <Select value={clientId} onValueChange={setClientId} required>
                  <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {clients.length === 0 && (
                  <p className="text-xs text-amber-600">No active clients — create a client first.</p>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cr-name">Restaurant name</Label>
                  <Input id="cr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lahore Restaurant" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cr-city">City</Label>
                  <Input id="cr-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lahore" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr-phone">Phone (optional)</Label>
                <Input id="cr-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 300 1234567" />
              </div>

              <div className="rounded-lg border p-4 space-y-3.5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label htmlFor="cr-license" className="text-sm">Issue license now</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Generates a secure CF-XXXX key immediately.
                    </p>
                  </div>
                  <Switch id="cr-license" checked={issueLicense} onCheckedChange={setIssueLicense} />
                </div>
                {issueLicense && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cr-months">Duration (months)</Label>
                      <Select value={months} onValueChange={setMonths}>
                        <SelectTrigger id="cr-months"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[3, 6, 12, 24, 36].map((m) => (
                            <SelectItem key={m} value={String(m)}>{m} months</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cr-devices">Max devices</Label>
                      <Select value={maxDevices} onValueChange={setMaxDevices}>
                        <SelectTrigger id="cr-devices"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 5, 10].map((d) => (
                            <SelectItem key={d} value={String(d)}>{d} terminal{d > 1 ? "s" : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={close}>Cancel</Button>
                <Button type="submit" disabled={loading || !clientId || clients.length === 0}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />} Create restaurant
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
