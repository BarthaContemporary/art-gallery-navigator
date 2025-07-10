import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useEnhancedIDriveStorage } from '@/hooks/use-enhanced-idrive-storage';
import { toast } from 'sonner';

interface StorageCredentialDownloadProps {
  currentBucket?: any; // For admin users to download specific bucket credentials
}

export function StorageCredentialDownload({ currentBucket }: StorageCredentialDownloadProps) {
  const { user, isAdmin } = useAuth();
  const { availableBuckets } = useEnhancedIDriveStorage();

  const handleDownloadCredentials = () => {
    let targetBucket;
    
    if (isAdmin && currentBucket) {
      // Admin downloading credentials for currently selected bucket
      targetBucket = currentBucket;
    } else {
      // Artist downloading their individual bucket credentials
      targetBucket = availableBuckets.find(bucket => bucket.type === 'individual');
    }
    
    if (!targetBucket) {
      toast.error('No storage credentials found');
      return;
    }

    const credentials = {
      endpoint: targetBucket.credentials.endpoint_url,
      accessKey: targetBucket.credentials.access_key,
      secretKey: targetBucket.credentials.secret_key,
      bucketName: targetBucket.credentials.bucket_name,
      region: 'us-east-1', // Default region for iDrive
      setup_instructions: {
        cloud_mounter_app: "https://apps.apple.com/gb/app/cloudmounter-cloud-manager/id1130254674?mt=12",
        instructions: [
          "1. Download and install CloudMounter from the App Store link above",
          "2. Open CloudMounter and select 'Amazon S3' as the connection type",
          "3. Enter the following credentials:",
          `   - Server: ${targetBucket.credentials.endpoint_url}`,
          `   - Access Key: ${targetBucket.credentials.access_key}`,
          `   - Secret Key: ${targetBucket.credentials.secret_key}`,
          `   - Bucket: ${targetBucket.credentials.bucket_name}`,
          `   - Region: us-east-1`,
          "4. Click 'Mount' to connect your storage",
          "5. Your cloud storage will appear as a local drive on your Mac"
        ]
      }
    };

    const bucketType = isAdmin ? targetBucket.type : 'artist';
    const fileName = `cloud-storage-credentials-${bucketType}-${targetBucket.credentials.bucket_name}.json`;

    const blob = new Blob([JSON.stringify(credentials, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Credentials downloaded successfully');
  };

  const openCloudMounter = () => {
    window.open('https://apps.apple.com/gb/app/cloudmounter-cloud-manager/id1130254674?mt=12', '_blank');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Download Storage Credentials
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {isAdmin && currentBucket 
            ? `Download credentials for the ${currentBucket.name} bucket to access files using desktop applications like CloudMounter.`
            : "Download your cloud storage credentials to access your files using desktop applications like CloudMounter."
          }
        </p>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={handleDownloadCredentials} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download Credentials
          </Button>
          
          <Button variant="outline" onClick={openCloudMounter} className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Get CloudMounter for Mac
          </Button>
        </div>
        
        <div className="text-xs text-muted-foreground">
          <p className="font-medium mb-1">CloudMounter Setup:</p>
          <p>Use the downloaded credentials file to configure CloudMounter and mount your cloud storage as a local drive.</p>
        </div>
      </CardContent>
    </Card>
  );
}