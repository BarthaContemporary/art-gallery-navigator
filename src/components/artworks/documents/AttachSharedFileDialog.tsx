import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Search, Download, ExternalLink, Link } from 'lucide-react';
import { toast } from 'sonner';
import { useEnhancedIDriveStorage } from '@/hooks/use-enhanced-idrive-storage';
import type { StorageItem } from '@/types/storage';

interface AttachSharedFileDialogProps {
  artworkId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AttachSharedFileDialog({ artworkId, open, onOpenChange }: AttachSharedFileDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<StorageItem[]>([]);
  const [isAttaching, setIsAttaching] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const queryClient = useQueryClient();

  const {
    loading,
    items,
    availableBuckets,
    currentBucket,
    initializeStorage,
    switchBucket,
    listFiles,
  } = useEnhancedIDriveStorage();

  // Initialize storage and select shared bucket when dialog opens
  useEffect(() => {
    if (open) {
      initializeStorage().then((buckets) => {
        const sharedBucket = buckets.find(bucket => bucket.name === 'Shared Gallery Storage');
        if (sharedBucket) {
          switchBucket(sharedBucket);
          listFiles('', sharedBucket);
        }
      });
    }
  }, [open, initializeStorage, switchBucket, listFiles]);

  const filteredFiles = items.filter(item => 
    !item.isFolder && // Only show files, not folders
    (item.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleFileToggle = (file: StorageItem) => {
    setSelectedFiles(prev => {
      const isSelected = prev.some(f => f.key === file.key);
      if (isSelected) {
        return prev.filter(f => f.key !== file.key);
      } else {
        return [...prev, file];
      }
    });
  };

  const handleFolderClick = async (folder: StorageItem) => {
    if (folder.isFolder) {
      const newPath = currentPath ? `${currentPath}/${folder.name}` : folder.name;
      setCurrentPath(newPath);
      await listFiles(newPath);
    }
  };

  const handleBackClick = async () => {
    if (currentPath) {
      const pathParts = currentPath.split('/');
      pathParts.pop();
      const newPath = pathParts.join('/');
      setCurrentPath(newPath);
      await listFiles(newPath);
    }
  };

  const generateFileUrl = (file: StorageItem) => {
    if (!currentBucket) return '';
    // Create a reference URL that can be used to access the file
    return `${currentBucket.credentials.endpoint_url}/${currentBucket.credentials.bucket_name}/${file.key}`;
  };

  const handleAttachFiles = async () => {
    if (selectedFiles.length === 0) return;

    setIsAttaching(true);
    try {
      const documentsToInsert = selectedFiles.map(file => ({
        artwork_id: artworkId,
        file_name: file.name,
        file_url: generateFileUrl(file),
        type: getFileType(file.name),
        description: `Shared file from ${currentBucket?.name || 'storage'}`,
        file_size: file.size,
        mime_type: getMimeType(file.name)
      }));

      const { error } = await supabase
        .from('documents')
        .insert(documentsToInsert);

      if (error) throw error;

      toast.success(`${selectedFiles.length} file(s) linked successfully`);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['artwork-documents', artworkId] });
      
      setSelectedFiles([]);
      onOpenChange(false);
    } catch (error) {
      console.error('Error linking files:', error);
      toast.error('Failed to link files');
    } finally {
      setIsAttaching(false);
    }
  };

  const getFileType = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf': return 'certificate';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif': return 'image';
      case 'doc':
      case 'docx': return 'document';
      case 'xls':
      case 'xlsx': return 'spreadsheet';
      default: return 'other';
    }
  };

  const getMimeType = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf': return 'application/pdf';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'png': return 'image/png';
      case 'gif': return 'image/gif';
      case 'doc': return 'application/msword';
      case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'xls': return 'application/vnd.ms-excel';
      case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      default: return 'application/octet-stream';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] h-[85vh] min-h-0 flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Link Shared Files to Artwork
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4 flex flex-col">
          {/* Navigation */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Path:</span>
            {currentPath ? (
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleBackClick}
                  className="h-auto p-1 text-xs"
                >
                  {currentBucket?.name}
                </Button>
                {currentPath.split('/').map((part, index, arr) => (
                  <React.Fragment key={index}>
                    <span>/</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newPath = arr.slice(0, index + 1).join('/');
                        setCurrentPath(newPath);
                        listFiles(newPath);
                      }}
                      className="h-auto p-1 text-xs"
                    >
                      {part}
                    </Button>
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <span>{currentBucket?.name || 'Loading...'}</span>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* File Browser */}
          <ScrollArea className="flex-1 min-h-0 border rounded-md">
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                Loading files...
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {/* Show folders first */}
                {items.filter(item => item.isFolder).map((folder) => (
                  <Card 
                    key={folder.key}
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => handleFolderClick(folder)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-blue-500" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{folder.name}</p>
                          <p className="text-xs text-muted-foreground">Folder</p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Show filtered files */}
                {filteredFiles.map((file) => {
                  const isSelected = selectedFiles.some(f => f.key === file.key);
                  return (
                    <Card 
                      key={file.key}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-accent'
                      }`}
                      onClick={() => handleFileToggle(file)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {formatFileSize(file.size)}
                              </span>
                              <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                                {getFileType(file.name)}
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                              <div className="h-2 w-2 rounded-full bg-white" />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {filteredFiles.length === 0 && !loading && (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p>No files found</p>
                    {searchTerm && (
                      <p className="text-sm mt-1">Try adjusting your search terms</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-gray-600">
              {selectedFiles.length} file(s) selected
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAttachFiles}
                disabled={selectedFiles.length === 0 || isAttaching}
              >
                {isAttaching ? 'Linking...' : `Link ${selectedFiles.length} File(s)`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}