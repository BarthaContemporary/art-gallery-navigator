
import { useAuth } from "@/hooks/use-auth";
import { EnhancedUserManagementSection } from "@/components/settings/EnhancedUserManagementSection";
import { BackupExportSection } from "@/components/settings/BackupExportSection";
import { UploadAssetsSection } from "@/components/settings/UploadAssetsSection";

export default function EnhancedUserSignup() {
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
      <EnhancedUserManagementSection />
      <BackupExportSection />
      <UploadAssetsSection />
    </div>
  );
}
