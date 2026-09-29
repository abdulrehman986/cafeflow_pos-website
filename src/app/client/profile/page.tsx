import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/table-kit";
import { ProfileForm, ChangePasswordForm } from "@/components/shared/profile-forms";
import { requireClientPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { Building2, Mail, CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClientProfilePage() {
  const user = await requireClientPage();
  const [profile, client] = await Promise.all([
    db.profile.findUnique({ where: { id: user.profileId }, select: { fullName: true, phone: true, lastLoginAt: true } }),
    db.client.findUnique({ where: { id: user.clientId! }, select: { companyName: true, createdAt: true, status: true } }),
  ]);

  return (
    <>
      <PageHeader title="Profile" description="Your account details and security settings." />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <ProfileForm initial={{ fullName: profile?.fullName ?? "", phone: profile?.phone ?? null }} />
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Business account</CardTitle>
              <CardDescription>Managed by CafeFlow administration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Business</span>
                <span className="font-medium">{client?.companyName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Login email</span>
                <span>{user.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Last login</span>
                <span>{fmtDateTime(profile?.lastLoginAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
        <ChangePasswordForm />
      </div>
    </>
  );
}
