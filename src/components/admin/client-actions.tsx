"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Copy,
  KeyRound,
  Loader2,
  Mail,
  ShieldBan,
  ShieldCheck,
  Trash2,
} from "lucide-react";

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
  const [confirm, setConfirm] = useState<{
    status: string;
    title: string;
    description: string;
  } | null>(null);

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
        newStatus === "ACTIVE"
          ? `${name} reactivated.`
          : newStatus === "SUSPENDED"
            ? `${name} suspended.`
            : `${name} deactivated.`,
      );
      router.refresh();
    } finally {
      setLoading(null);
      setConfirm(null);
    }
  }

  const NEXT: Record<
    string,
    {
      status: string;
      label: string;
      icon: React.ElementType;
      variant: "default" | "outline" | "destructive";
      danger: boolean;
      title: string;
      description: string;
    }
  > = {
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
      description:
        "Access is restored for the client's login accounts and POS devices.",
    },
    DEACTIVATED: {
      status: "ACTIVE",
      label: "Activate",
      icon: ShieldCheck,
      variant: "default",
      danger: false,
      title: `Reactivate ${name}?`,
      description:
        "Access is restored for the client's login accounts and POS devices.",
    },
  };

  const next = NEXT[status] ?? NEXT.ACTIVE;

  return (
    <>
      <Button
        variant={next.variant}
        size="sm"
        disabled={loading !== null}
        onClick={() =>
          next.danger ? setConfirm(next) : applyStatus(next.status)
        }
      >
        {loading === next.status ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <next.icon className="h-4 w-4" />
        )}
        {next.label}
      </Button>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(v) => !v && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirm && applyStatus(confirm.status)}
              className={
                confirm?.status === "SUSPENDED"
                  ? "bg-amber-600 hover:bg-amber-700"
                  : ""
              }
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ClientPasswordActions({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"LINK" | "TEMPORARY" | null>(null);
  const [linkConfirm, setLinkConfirm] = useState(false);
  const [temporaryOpen, setTemporaryOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<{
    email: string;
    password: string;
  } | null>(null);

  async function submit(mode: "LINK" | "TEMPORARY") {
    setLoading(mode);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          ...(mode === "TEMPORARY" && password ? { password } : {}),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Password action failed.");
        return;
      }
      if (mode === "LINK") {
        toast.success(json.data.message);
        setLinkConfirm(false);
      } else {
        setResult(json.data.account);
        setPassword("");
        setTemporaryOpen(false);
      }
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function copyTemporaryPassword() {
    if (!result) return;
    await navigator.clipboard.writeText(result.password);
    toast.success("Temporary password copied.");
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setLinkConfirm(true)}
        disabled={loading !== null}
      >
        {loading === "LINK" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
        Email reset link
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setTemporaryOpen(true)}
        disabled={loading !== null}
      >
        <KeyRound className="h-4 w-4" /> Set temporary password
      </Button>

      <AlertDialog open={linkConfirm} onOpenChange={setLinkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Email a reset link?</AlertDialogTitle>
            <AlertDialogDescription>
              A one-time password reset link will be sent to {clientName}&apos;s
              linked login email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => submit("LINK")}>
              {loading === "LINK" && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}{" "}
              Send link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={temporaryOpen} onOpenChange={setTemporaryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set a temporary password</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a password or leave it blank to generate one. It will be
              shown only once after saving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="temporary-password">Temporary password</Label>
            <Input
              id="temporary-password"
              type="text"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Leave blank to generate"
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => submit("TEMPORARY")}>
              {loading === "TEMPORARY" && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}{" "}
              Save password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={result !== null}
        onOpenChange={(open) => !open && setResult(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Temporary password created</AlertDialogTitle>
            <AlertDialogDescription>
              Share these credentials securely with the client. The password
              cannot be recovered later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {result && (
            <div className="space-y-3 rounded-md border bg-muted/40 p-3 text-sm">
              <div>
                <span className="text-muted-foreground">Email:</span>{" "}
                {result.email}
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-muted-foreground">Password:</span>{" "}
                  <code className="break-all">{result.password}</code>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyTemporaryPassword}
                  title="Copy temporary password"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setResult(null)}>
              Done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Delete — only possible for clients with zero restaurants. */
export function ClientDeleteButton({
  clientId,
  name,
  hasRestaurants,
}: {
  clientId: string;
  name: string;
  hasRestaurants: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: "DELETE",
      });
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
      <Button
        variant="outline"
        size="sm"
        disabled={hasRestaurants || loading}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" /> Delete
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the client and their login account. Only
              possible while the client owns no restaurants.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Delete
              permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
