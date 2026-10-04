import { DashboardSkeleton } from "@/components/dashboard/skeleton";

/**
 * Instant feedback while the admin page segment streams in from the server.
 * Without this boundary every navigation waited for the full server render
 * (auth + DB + markup) before painting anything.
 */
export default function AdminLoading() {
  return <DashboardSkeleton />;
}
