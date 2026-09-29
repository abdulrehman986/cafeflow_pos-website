"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Loader2, ShieldBan, ShieldCheck, Trash2, Pencil } from "lucide-react";

/** Suspend / Activate / Deactivate toggle for a client. */
export function ClientStatusActions({
  clientId,
  status,
  name,
}: {
  clientId: string;
  status: string;
  name: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ status: string; title: string; description: string } | null>(null);

  async function applyStatus(newStatus: string) {
    setLoading(newStatus);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Action failed.");
        return;
      }
      toast.success(
        newStatus === "ACTIVE" ? `${name} reactivated.` : newStatus === "SUSPENDED" ? `${name} suspended.` : `${name} deactivated.`
      );
      router.refresh();
    } finally {
      setLoading(null);
      setConfirm(null);
    }
  }

  const NEXT: Record<string, { status: string; label: string; icon: React.ElementType; variant: "default" | "outline" | "destructive"; danger: boolean; title: string; description: string }> = {
    ACTIVE: {
      status: "SUSPENDED",
      label: "Suspend",
      icon: ShieldBan,
      variant: "outline",
      danger: true,
      title: `Suspend ${name}?`,
      description:
        "The client and their login accounts lose access immediately. Restaurants keep their data; devices stop syncing. You can reactivate anytime.",
    },
    SUSPENDED: {
      status: "ACTIVE",
      label: "Activate",
      icon: ShieldCheck,
      variant: "default",
      danger: false,
      title: `Reactivate ${name}?`,
      description: "Access is restored for the client's login accounts and POS devices.",
    },
    DEACTIVATED: {
      status: "ACTIVE",
      label: "Activate",
      icon: ShieldCheck,
      variant: "default",
      danger: false,
      title: `Reactivate ${name}?`,
      description: "Access is restored for the client's login accounts and POS devices.",
    },
  };

  const next = NEXT[status] ?? NEXT.ACTIVE;

  return (
    <>
      <Button
        variant={next.variant}
        size="sm"
        disabled={loading !== null}
        onClick={() => (next.danger ? setConfirm(next) : applyStatus(next.status))}
      >
        {loading === next.status ? <Loader2 className="h-4 w-4 animate-spin" /> : <next.icon className="h-4 w-4" />}
        {next.label}
      </Button>

      <AlertDialog open={confirm !== null} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirm && applyStatus(confirm.status)}
              className={confirm?.status === "SUSPENDED" ? "bg-amber-600 hover:bg-amber-700" : ""}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Delete — only possible for clients with zero restaurants. */
export function ClientDeleteButton({ clientId, name, hasRestaurants }: { clientId: string; name: string; hasRestaurants: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Delete failed.");
        return;
      }
      toast.success(`${name} deleted.`);
      router.push("/admin/clients");
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" disabled={hasRestaurants || loading} onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" /> Delete
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the client and their login account. Only possible
              while the client owns no restaurants.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-white hover:bg-destructive/90">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
