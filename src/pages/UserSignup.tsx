
import { useAuth } from "@/hooks/use-auth";
import { UserManagementSection } from "@/components/settings/UserManagementSection";
import { BackupExportSection } from "@/components/settings/BackupExportSection";
import { UploadAssetsSection } from "@/components/settings/UploadAssetsSection";
import { ImageHealthDashboard } from "@/components/artworks/ImageHealthDashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
      <UserManagementSection />
      
      <Card>
        <CardHeader>
          <CardTitle>Image Health Management</CardTitle>
          <CardDescription>
            Monitor and manage the health of all images in your artwork collection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImageHealthDashboard />
        </CardContent>
      </Card>
      
      <BackupExportSection />
      <UploadAssetsSection />
    </div>
  );
}
