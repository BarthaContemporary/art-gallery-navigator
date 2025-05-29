
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { UserManagementSection } from "@/components/settings/UserManagementSection";
import { BackupExportSection } from "@/components/settings/BackupExportSection";
import { UploadAssetsSection } from "@/components/settings/UploadAssetsSection";

export default function UserSignup() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xl font-semibold text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-8">
      <PageHeader title="SETTINGS" />
      
      <UserManagementSection />
      <BackupExportSection />
      <UploadAssetsSection />
    </div>
  );
}
