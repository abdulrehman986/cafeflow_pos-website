"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock, FileText, Loader2, Receipt, ShieldCheck } from "lucide-react";

export interface ActiveGrantInfo {
  id: string;
  reason: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Break-glass support access for one client. Without a grant the admin cannot
 * see this client's orders/sales detail; a grant is time-boxed, requires a
 * written reason, and every detail view under it is audit-logged.
 */
export function SupportAccessActions({
  clientId,
  activeGrant,
}: {
  clientId: string;
  activeGrant: ActiveGrantInfo | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState("4");
  const [loading, setLoading] = useState<"create" | "revoke" | null>(null);

  async function createGrant() {
    setLoading("create");
    try {
      const res = await fetch("/api/admin/support-grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, reason, hours: Number(hours) }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Could not create support access.");
        return;
      }
      toast.success("Support access granted — every view is audit-logged.");
      setReason("");
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function revokeGrant() {
    if (!activeGrant) return;
    setLoading("revoke");
    try {
      const res = await fetch(`/api/admin/support-grants?id=${activeGrant.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Could not revoke support access.");
        return;
      }
      toast.success("Support access revoked.");
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <Button
        variant={activeGrant ? "destructive" : "outline"}
        size="sm"
        onClick={() => (activeGrant ? revokeGrant() : setOpen(true))}
        disabled={loading !== null}
      >
        {loading !== null ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : activeGrant ? (
          <ShieldCheck className="h-4 w-4" />
        ) : (
          <Clock className="h-4 w-4" />
        )}
        {activeGrant ? "Revoke support access" : "Support access"}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Grant support access?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be able to view this client&apos;s individual orders and
              sales for a limited time. Every view is recorded in the audit log
              with your account. The client&apos;s data remains untouched —
              support access is read-only.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="support-reason">Reason (required, kept in the audit log)</Label>
              <Textarea
                id="support-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Client reported missing order #1234 from today's sync"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-hours">Duration (max 24h)</Label>
              <Input
                id="support-hours"
                type="number"
                min={1}
                max={24}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={createGrant}
              disabled={reason.trim().length < 10 || loading !== null}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {loading === "create" && <Loader2 className="h-4 w-4 animate-spin" />}
              Grant access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Links shown on the client detail page while a support grant is active. */
export function SupportDetailLinks({ clientId }: { clientId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={`/admin/clients/${clientId}/orders`}>
          <Receipt className="h-4 w-4" /> View orders
        </Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={`/admin/clients/${clientId}/sales`}>
          <FileText className="h-4 w-4" /> View sales
        </Link>
      </Button>
    </div>
  );
}
