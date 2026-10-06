import { ShieldAlert } from "lucide-react";

/**
 * Banner shown on every grant-gated admin detail page. Reminds the admin that
 * the session is audited and when access expires.
 */
export function SupportAccessBanner({
  clientName,
  reason,
  expiresAt,
}: {
  clientName: string;
  reason: string;
  expiresAt: Date;
}) {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
      <p className="text-sm font-medium flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        Support access for {clientName} — expires {expiresAt.toLocaleString("en-GB", { timeZone: "UTC" })} UTC
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Reason: {reason} · This view has been recorded in the audit log.
      </p>
    </div>
  );
}
