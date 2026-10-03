import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/table-kit";
import {
  ProfileForm,
  ChangePasswordForm,
} from "@/components/shared/profile-forms";
import { requireAdminPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { ShieldCheck, Server, Database, KeyRound } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const user = await requireAdminPage();
  const profile = await db.profile.findUnique({
    where: { id: user.profileId },
    select: { fullName: true, phone: true, email: true, lastLoginAt: true },
  });

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your admin account and platform information."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileForm
          initial={{
            fullName: profile?.fullName ?? "",
            phone: profile?.phone ?? null,
          }}
        />
        <ChangePasswordForm />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium">SUPER_ADMIN</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last login</span>
              <span>{fmtDateTime(profile?.lastLoginAt)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Platform</CardTitle>
            <CardDescription>Architecture at a glance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                icon: ShieldCheck,
                label: "Auth",
                value: "JWT sessions (httpOnly cookies) + bcrypt",
              },
              {
                icon: Server,
                label: "POS API",
                value: "Device tokens (HS256, server-verifiable)",
              },
              {
                icon: Database,
                label: "Database",
                value: "MySQL-compatible schema via Prisma",
              },
              {
                icon: KeyRound,
                label: "Security",
                value: "Role-based access control and protected API routes",
              },
            ].map((r) => (
              <div key={r.label} className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 text-primary p-2">
                  <r.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{r.label}</p>
                  <p className="text-sm font-medium">{r.value}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
