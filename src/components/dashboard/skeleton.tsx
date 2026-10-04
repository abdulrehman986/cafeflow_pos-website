import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder shown while a dashboard page renders on the server. Rendered
 * inside the DashboardShell (loading.tsx lives under the auth layouts), so
 * the sidebar and top bar stay visible and only the content area pulses.
 *
 * Stats/table rows are mildly randomized per mount so repeated navigations
 * don't flash a suspiciously identical skeleton.
 */
export function DashboardSkeleton({
  statCards = 4,
  showChart = true,
}: {
  statCards?: number;
  showChart?: boolean;
}) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-1.5">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: statCards }).map((_, i) => (
          <Card key={i} className="gap-3 py-4">
            <CardHeader className="px-4">
              <Skeleton className="h-3.5 w-24" />
            </CardHeader>
            <CardContent className="px-4">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="mt-2 h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>

      {showChart && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-3.5 w-72" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-72 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-72 w-full" />
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-9 w-9 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/** Table-style placeholder for list pages (clients, restaurants, sales…). */
export function TableSkeleton({ rows = 8, toolbar = true }: { rows?: number; toolbar?: boolean }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      {toolbar && (
        <div className="flex flex-col sm:flex-row gap-2.5">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-full sm:w-[170px]" />
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-4 border-b pb-3">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="ml-auto h-3.5 w-16" />
          </div>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
