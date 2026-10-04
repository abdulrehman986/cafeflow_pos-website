import { DashboardSkeleton } from "@/components/dashboard/skeleton";

/**
 * Instant feedback while the client page segment streams in from the server.
 * Without this boundary every navigation waited for the full server render
 * (auth + DB + markup) before painting anything.
 */
export default function ClientLoading() {
  return <DashboardSkeleton />;
}
