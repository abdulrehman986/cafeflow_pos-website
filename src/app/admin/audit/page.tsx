import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/shared/table-kit";
import { UrlPagination } from "@/components/shared/filter-toolbar";
import { requireAdminPage } from "@/lib/auth/guards";
import { listAuditLogs } from "@/lib/services/support";
import { fmtDateTime } from "@/lib/format";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function actionTone(action: string): "default" | "secondary" | "destructive" | "outline" {
  if (action.startsWith("SUPPORT_GRANT_CREATE")) return "destructive";
  if (action === "SUPPORT_GRANT_REVOKE") return "default";
  return "secondary";
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string }>;
}) {
  await requireAdminPage();

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const result = await listAuditLogs({
    page,
    pageSize: PAGE_SIZE,
    action: sp.action || undefined,
  });

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Support-grant lifecycle and every order/sales detail view made under a grant."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Sensitive access events
          </CardTitle>
          <CardDescription>
            {result.total} event{result.total === 1 ? "" : "s"} recorded · newest first
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {result.rows.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="h-6 w-6 text-muted-foreground" />}
              title="No audit events yet"
              description="Events appear here when support access is granted, revoked, or used to view client detail."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((e) => {
                    let meta: Record<string, unknown> | null = null;
                    try {
                      meta = e.metadata ? (JSON.parse(e.metadata) as Record<string, unknown>) : null;
                    } catch {
                      meta = null;
                    }
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="text-sm whitespace-nowrap">{fmtDateTime(e.createdAt)}</TableCell>
                        <TableCell>
                          <Badge variant={actionTone(e.action)} className="text-xs font-normal">
                            {e.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {e.actorEmail}
                          {meta && typeof meta.reason === "string" && (
                            <p className="text-xs text-muted-foreground max-w-56 truncate">{meta.reason}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {e.targetType ? `${e.targetType} ` : ""}
                          {e.targetId ? <code className="text-xs">{e.targetId.slice(0, 8)}…</code> : null}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-72">
                          <code className="break-all line-clamp-2">
                            {meta ? Object.entries(meta)
                              .filter(([k]) => k !== "reason")
                              .map(([k, v]) => `${k}: ${String(v)}`)
                              .join(" · ") : "—"}
                          </code>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {result.total > 0 && <UrlPagination page={result.page} pageSize={result.pageSize} total={result.total} />}
    </>
  );
}
