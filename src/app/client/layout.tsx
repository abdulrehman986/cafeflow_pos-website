import { requireClientPage } from "@/lib/auth/guards";
import { DashboardShell } from "@/components/dashboard/shell";
import { db } from "@/lib/db";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  // Server-side authorization: layout guards every /client page.
  const user = await requireClientPage();
  const client = user.clientId
    ? await db.client.findUnique({
        where: { id: user.clientId },
        select: { companyName: true },
      })
    : null;
  return (
    <DashboardShell
      variant="client"
      user={{ fullName: user.fullName, email: user.email }}
      businessName={client?.companyName}
    >
      {children}
    </DashboardShell>
  );
}
