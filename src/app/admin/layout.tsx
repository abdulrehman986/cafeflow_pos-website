import { requireAdminPage } from "@/lib/auth/guards";
import { DashboardShell } from "@/components/dashboard/shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Server-side authorization: layout guards every /admin page.
  const user = await requireAdminPage();
  return (
    <DashboardShell variant="admin" user={{ fullName: user.fullName, email: user.email }}>
      {children}
    </DashboardShell>
  );
}
