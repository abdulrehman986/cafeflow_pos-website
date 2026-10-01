"use client";

import { useState } from "react";
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
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  MoreHorizontal,
  ShieldCheck,
  ShieldBan,
  Ban,
  CalendarPlus,
  MonitorSmartphone,
} from "lucide-react";

interface LicenseRow {
  id: string;
  licenseKey: string;
  status: string;
  maxDevices: number;
  activeDevices: number;
  expiresAt: string | Date;
  restaurantName: string;
}

/** Row actions: activate / suspend / revoke / extend / devices info. */
export function LicenseRowActions({ license }: { license: LicenseRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{
    action: string;
    title: string;
    description: string;
  } | null>(null);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendMonths, setExtendMonths] = useState("1");
  const [maxDevices, setMaxDevices] = useState(String(license.maxDevices));

  async function patch(data: Record<string, unknown>, successMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/licenses/${license.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Action failed.");
        return false;
      }
      toast.success(successMsg);
      router.refresh();
      return true;
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  const actions: Array<{
    action: string;
    label: string;
    icon: React.ElementType;
    danger?: boolean;
    confirm: { title: string; description: string };
  }> = [];

  if (license.status === "PENDING") {
    actions.push({
      action: "activate",
      label: "Activate license",
      icon: ShieldCheck,
      confirm: {
        title: "Activate this license?",
        description:
          "The license becomes usable for POS activation immediately.",
      },
    });
  }
  if (
    license.status === "EXPIRED" ||
    license.status === "SUSPENDED" ||
    license.status === "PENDING"
  ) {
    actions.push({
      action: "reactivate",
      label: "Reactivate",
      icon: ShieldCheck,
      confirm: {
        title: "Reactivate this license?",
        description:
          "Sets the license to ACTIVE. If it has expired, extend the expiry too — an ACTIVE license past its date is treated as expired.",
      },
    });
  }
  if (license.status === "ACTIVE" || license.status === "PENDING") {
    actions.push({
      action: "suspend",
      label: "Suspend",
      icon: ShieldBan,
      danger: true,
      confirm: {
        title: "Suspend this license?",
        description:
          "POS verification will fail with LICENSE_SUSPENDED on the next check. Devices stop syncing.",
      },
    });
  }
  if (license.status !== "REVOKED") {
    actions.push({
      action: "revoke",
      label: "Revoke permanently",
      icon: Ban,
      danger: true,
      confirm: {
        title: "Revoke this license?",
        description:
          "Permanent: the key can never be used again. Devices stop syncing. A new license can be issued for the restaurant afterwards.",
      },
    });
  }

  async function runAction(action: string) {
    switch (action) {
      case "activate":
        return patch({ status: "ACTIVE" }, "License activated.");
      case "reactivate":
        return patch({ status: "ACTIVE" }, "License reactivated.");
      case "suspend":
        return patch({ status: "SUSPENDED" }, "License suspended.");
      case "revoke":
        return patch({ status: "REVOKED" }, "License revoked.");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            aria-label="License actions"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>License actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {actions.map((a) => (
            <DropdownMenuItem
              key={a.action}
              onClick={() => setConfirm({ action: a.action, ...a.confirm })}
              variant={a.danger ? "destructive" : "default"}
            >
              <a.icon className="h-4 w-4" /> {a.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onClick={() => setExtendOpen(true)}>
            <CalendarPlus className="h-4 w-4" /> Extend / edit
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirm dialog */}
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
              onClick={() => confirm && runAction(confirm.action)}
              className={
                confirm?.action === "revoke" || confirm?.action === "suspend"
                  ? "bg-destructive text-white hover:bg-destructive/90"
                  : ""
              }
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Extend / max devices dialog */}
      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Extend license</DialogTitle>
            <DialogDescription>
              {license.licenseKey} · {license.restaurantName} · currently
              expires{" "}
              {new Date(license.expiresAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Extend by (months)</Label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 3, 6, 12].map((m) => (
                  <Button
                    key={m}
                    type="button"
                    variant={extendMonths === String(m) ? "default" : "outline"}
                    size="sm"
                    onClick={() => setExtendMonths(String(m))}
                  >
                    +{m}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Extensions add months to the current expiry (or from today if
                already expired) and revive an expired license.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="la-devices">Max devices</Label>
              <Input
                id="la-devices"
                type="number"
                min={1}
                max={20}
                value={maxDevices}
                onChange={(e) => setMaxDevices(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {license.activeDevices} device(s) currently active on this
                license.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                const ok1 = await patch(
                  {
                    extendMonths: parseInt(extendMonths, 10),
                    maxDevices: parseInt(maxDevices, 10),
                  },
                  "License extended.",
                );
                if (ok1) setExtendOpen(false);
              }}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
              changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
