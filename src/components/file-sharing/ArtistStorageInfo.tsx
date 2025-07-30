import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Cloud, AlertCircle, CheckCircle, FolderOpen } from "lucide-react";

interface ArtistStorageInfoProps {
  bucketName: string | null;
  hasCredentials: boolean;
  error: string | null;
}

export function ArtistStorageInfo({ bucketName, hasCredentials, error }: ArtistStorageInfoProps) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Artist Storage Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">Your Storage Bucket</div>
                  <div className="text-sm text-muted-foreground">
                    {bucketName || 'Not available'}
                  </div>
                </div>
              </div>
              <Badge variant={bucketName ? "secondary" : "outline"}>
                {bucketName ? "Available" : "Not Set"}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">Storage Credentials</div>
                  <div className="text-sm text-muted-foreground">
                    Access to your personal storage
                  </div>
                </div>
              </div>
              <Badge variant={hasCredentials ? "secondary" : "outline"}>
                {hasCredentials ? "Configured" : "Not Configured"}
              </Badge>
            </div>
          </div>

          {!hasCredentials && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your storage credentials haven't been configured yet. Please contact the administrator to set up access to your personal storage bucket.
              </AlertDescription>
            </Alert>
          )}

          {hasCredentials && bucketName && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                You have access to your personal storage bucket: <code className="font-mono">{bucketName}</code>. 
                Your files are stored securely and are only accessible to you.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}