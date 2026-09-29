"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Loader2, MoreHorizontal, RotateCcw, ShieldBan, ShieldOff } from "lucide-react";

/** Device row actions: deactivate (free slot), block, reactivate. */
export function DeviceRowActions({
  deviceId,
  identifier,
  status,
  restaurantName,
}: {
  deviceId: string;
  identifier: string;
  status: string;
  restaurantName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ status: string; title: string; description: string } | null>(null);

  async function apply(status: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/devices?id=${deviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Action failed.");
        return;
      }
      toast.success(json.data.message);
      router.refresh();
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={busy} aria-label="Device actions">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {status !== "DEACTIVATED" && (
            <DropdownMenuItem
              onClick={() =>
                setConfirm({
                  status: "DEACTIVATED",
                  title: `Deactivate ${identifier}?`,
                  description:
                    `Frees a device slot on ${restaurantName}'s license. Use this after a Windows reinstall or hardware change — the terminal can re-activate with the license key.`,
                })
              }
            >
              <ShieldOff className="h-4 w-4" /> Deactivate (reset slot)
            </DropdownMenuItem>
          )}
          {status !== "BLOCKED" && (
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                setConfirm({
                  status: "BLOCKED",
                  title: `Block ${identifier}?`,
                  description:
                    "Its device token stops working immediately and the terminal cannot re-activate on its own. Unblock later to restore.",
                })
              }
            >
              <ShieldBan className="h-4 w-4" /> Block device
            </DropdownMenuItem>
          )}
          {status !== "ACTIVE" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => apply("ACTIVE")}>
                <RotateCcw className="h-4 w-4" /> Reactivate
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirm !== null} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirm && apply(confirm.status)}
              className={confirm?.status === "BLOCKED" ? "bg-destructive text-white hover:bg-destructive/90" : ""}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
