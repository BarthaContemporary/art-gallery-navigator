import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Upload, 
  FolderPlus, 
  Download, 
  Folder, 
  File, 
  ArrowLeft,
  RefreshCw,
  Cloud,
  Users,
  User,
  Settings
} from 'lucide-react';
import { useEnhancedIDriveStorage } from '@/hooks/use-enhanced-idrive-storage';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { StorageItem } from '@/types/storage';

interface EnhancedIDriveFileManagerProps {
  mode?: 'shared' | 'personal';
}

export function EnhancedIDriveFileManager({ mode = 'personal' }: EnhancedIDriveFileManagerProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  
  const { isAdmin } = useAuth();
  
  const {
    loading,
    items,
    availableBuckets,
    currentBucket,
    initializeStorage,
    switchBucket,
    listFiles,
    uploadFile,
    createFolder,
    downloadFile,
  } = useEnhancedIDriveStorage();

  // Filter buckets based on mode
  const filteredBuckets = mode === 'shared' 
    ? availableBuckets.filter(bucket => bucket.type === 'shared')
    : isAdmin 
      ? availableBuckets.filter(bucket => bucket.type === 'individual' || bucket.type === 'admin') // Admin sees individual and admin buckets in personal mode
      : availableBuckets.filter(bucket => bucket.type === 'individual'); // Artists see only their bucket

  // For admin users in "My Storage", create virtual folders for each bucket
  const adminBucketFolders = isAdmin && mode === 'personal' 
    ? filteredBuckets.map(bucket => ({
        name: bucket.name,
        key: `bucket:${bucket.credentials.bucket_name}`,
        isFolder: true,
        bucket: bucket,
        size: 0,
        lastModified: '',
      }))
    : [];

  useEffect(() => {
    const init = async () => {
      try {
        const buckets = await initializeStorage();
        
        // Auto-select bucket based on mode - only if no bucket is currently selected
        if (!currentBucket) {
          if (mode === 'shared') {
            const sharedBucket = buckets.find(b => b.type === 'shared');
            if (sharedBucket) {
              switchBucket(sharedBucket);
            }
          } else if (mode === 'personal' && isAdmin) {
            // For admin in personal mode, don't auto-select a bucket, show bucket folders instead
            switchBucket(null);
          } else if (!isAdmin) {
            // Artists automatically get their individual bucket
            const individualBucket = buckets.find(b => b.type === 'individual');
            if (individualBucket) {
              switchBucket(individualBucket);
            }
          }
        }
      } catch (error) {
        console.error('Failed to initialize:', error);
      }
    };
    init();
  }, [initializeStorage, mode, isAdmin, switchBucket]);

  useEffect(() => {
    if (currentBucket) {
      listFiles(currentPath);
    } else if (isAdmin && mode === 'personal') {
      // For admin in personal mode without a bucket, show bucket folders
      // This will be handled in the render section
    }
  }, [currentBucket, listFiles, currentPath, isAdmin, mode]);

  const handleBucketChange = (bucketName: string) => {
    const bucket = filteredBuckets.find(b => b.credentials.bucket_name === bucketName);
    if (bucket) {
      switchBucket(bucket);
      setCurrentPath('');
    }
  };

  // Show bucket selector only for non-admin users in personal mode with multiple buckets
  const showBucketSelector = (mode === 'personal' && !isAdmin && filteredBuckets.length > 1);

  const handleFolderClick = async (item: StorageItem) => {
    if (item.key.startsWith('bucket:')) {
      // Handle bucket folder click for admin users
      const bucketName = item.key.replace('bucket:', '');
      const bucket = availableBuckets.find(b => b.credentials.bucket_name === bucketName);
      if (bucket) {
        switchBucket(bucket);
        setCurrentPath('');
        // Pass the bucket explicitly to avoid state timing issues
        await listFiles('', bucket);
      }
    } else {
      // Handle regular folder navigation
      setCurrentPath(item.key);
      await listFiles(item.key);
    }
  };

  const handleBackClick = async () => {
    if (currentPath) {
      const parentPath = currentPath.split('/').slice(0, -1).join('/');
      setCurrentPath(parentPath);
      await listFiles(parentPath);
    } else if (currentBucket && isAdmin && mode === 'personal') {
      // Go back to bucket folder view for admin users
      switchBucket(null);
      setCurrentPath('');
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        await uploadFile(selectedFiles[i], currentPath);
      }
      setUploadDialogOpen(false);
      setSelectedFiles(null);
      await listFiles(currentPath);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Please enter a folder name');
      return;
    }

    try {
      await createFolder(newFolderName, currentPath);
      setCreateFolderDialogOpen(false);
      setNewFolderName('');
      await listFiles(currentPath);
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  const handleDownload = async (key: string) => {
    try {
      await downloadFile(key);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getBucketIcon = (type: 'individual' | 'shared' | 'admin') => {
    switch (type) {
      case 'shared':
        return <Users className="h-4 w-4" />;
      case 'admin':
        return <Settings className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getBucketVariant = (type: 'individual' | 'shared' | 'admin') => {
    switch (type) {
      case 'shared':
        return 'default' as const;
      case 'admin':
        return 'destructive' as const;
      default:
        return 'secondary' as const;
    }
  };

  if (availableBuckets.length === 0 || (mode === 'personal' && !isAdmin && !currentBucket)) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <Cloud className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium">No Storage Available</p>
              <p className="text-sm text-muted-foreground">
                Storage buckets have not been configured for your account. Please contact the administrator.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">      
      {/* Bucket Selector - Only show for admins in personal mode with multiple buckets */}
      {showBucketSelector && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Cloud className="h-5 w-5" />
                <span className="font-medium">Storage Bucket:</span>
              </div>
              <Select 
                value={currentBucket?.credentials.bucket_name || ''} 
                onValueChange={handleBucketChange}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select a storage bucket" />
                </SelectTrigger>
                <SelectContent>
                  {filteredBuckets.map((bucket) => (
                    <SelectItem key={bucket.credentials.bucket_name} value={bucket.credentials.bucket_name}>
                      <div className="flex items-center gap-2">
                        {getBucketIcon(bucket.type)}
                        <span>{bucket.name}</span>
                        <Badge variant={getBucketVariant(bucket.type)} className="ml-2">
                          {bucket.type}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File Manager */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => listFiles(currentPath)}
                disabled={loading || !currentBucket}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Dialog open={createFolderDialogOpen} onOpenChange={setCreateFolderDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={!currentBucket}>
                    <FolderPlus className="h-4 w-4 mr-2" />
                    New Folder
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Folder</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input
                      placeholder="Folder name"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setCreateFolderDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleCreateFolder}>Create</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={!currentBucket}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Files</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Uploading to: <strong>{currentBucket?.name}</strong>
                    </div>
                    <Input
                      type="file"
                      multiple
                      onChange={(e) => setSelectedFiles(e.target.files)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setUploadDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleFileUpload} disabled={loading}>
                        Upload
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          {(currentPath || (currentBucket && isAdmin && mode === 'personal')) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackClick}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <span>
                {currentBucket ? (
                  <>
                    <Cloud className="inline h-4 w-4 mr-1" />
                    {currentBucket.name}
                    {currentPath && ` / ${currentPath}`}
                  </>
                ) : isAdmin && mode === 'personal' ? (
                  <>
                    <Folder className="inline h-4 w-4 mr-1" />
                    My Storage
                  </>
                ) : (
                  `/${currentPath}`
                )}
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!currentBucket && !(isAdmin && mode === 'personal') ? (
            <div className="text-center py-8">
              <Cloud className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Please select a storage bucket to continue</p>
            </div>
          ) : loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Loading files...</p>
            </div>
          ) : (!currentBucket && isAdmin && mode === 'personal') ? (
            // Show bucket folders for admin users
            <div className="space-y-2">
              {adminBucketFolders.map((item) => (
                <button
                  key={item.key}
                  onClick={() => handleFolderClick(item)}
                  className="w-full flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group text-left"
                >
                  <div className="flex items-center gap-3">
                    {getBucketIcon(item.bucket?.type || 'individual')}
                    <div>
                      <p className="font-medium group-hover:text-primary transition-colors">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Storage bucket • Click to open
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getBucketVariant(item.bucket?.type || 'individual')}>
                      {item.bucket?.type || 'individual'}
                    </Badge>
                    <div className="flex items-center text-muted-foreground group-hover:text-primary transition-colors">
                      <span className="text-sm mr-1">Open</span>
                      <ArrowLeft className="h-4 w-4 rotate-180" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8">
              <Folder className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">This folder is empty</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {item.isFolder ? (
                      <Folder className="h-5 w-5 text-blue-500" />
                    ) : (
                      <File className="h-5 w-5 text-gray-500" />
                    )}
                    <div>
                      <p className="font-medium">{item.name}</p>
                      {!item.isFolder && (
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(item.size)}
                          {item.lastModified && (
                            <span className="ml-2">
                              {new Date(item.lastModified).toLocaleDateString()}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.isFolder ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFolderClick(item)}
                      >
                        Open
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(item.key)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}