import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDocuments } from '@/hooks/use-documents';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Search } from 'lucide-react';
import { toast } from 'sonner';

interface AttachDocumentDialogProps {
  artworkId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AttachDocumentDialog({ artworkId, open, onOpenChange }: AttachDocumentDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [isAttaching, setIsAttaching] = useState(false);
  const queryClient = useQueryClient();

  const { data: documents, isLoading } = useDocuments();

  const filteredDocuments = documents?.filter(doc => 
    !doc.artwork_id && // Only show unattached documents
    (doc.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     doc.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
     doc.description?.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  const handleDocumentToggle = (documentId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(documentId)
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };

  const handleAttachDocuments = async () => {
    if (selectedDocuments.length === 0) return;

    setIsAttaching(true);
    try {
      const { error } = await supabase
        .from('documents')
        .update({ artwork_id: artworkId })
        .in('id', selectedDocuments);

      if (error) throw error;

      toast.success(`${selectedDocuments.length} document(s) attached successfully`);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['artwork-documents', artworkId] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      
      setSelectedDocuments([]);
      onOpenChange(false);
    } catch (error) {
      console.error('Error attaching documents:', error);
      toast.error('Failed to attach documents');
    } finally {
      setIsAttaching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] h-[80vh] min-h-0 flex flex-col">
        <DialogHeader>
          <DialogTitle>Attach Documents</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4 flex flex-col">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <ScrollArea className="flex-1 min-h-0 border rounded-md p-4">
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">
                Loading documents...
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>No available documents found</p>
                {searchTerm && (
                  <p className="text-sm mt-1">Try adjusting your search terms</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocuments.map((document) => (
                  <div
                    key={document.id}
                    className="flex items-center space-x-3 p-3 border rounded-md hover:bg-gray-50"
                  >
                    <Checkbox
                      checked={selectedDocuments.includes(document.id)}
                      onCheckedChange={() => handleDocumentToggle(document.id)}
                    />
                    <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {document.file_name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                          {document.type}
                        </span>
                        {document.description && (
                          <span className="text-xs text-gray-500 truncate">
                            {document.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-gray-600">
              {selectedDocuments.length} document(s) selected
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAttachDocuments}
                disabled={selectedDocuments.length === 0 || isAttaching}
              >
                {isAttaching ? 'Attaching...' : `Attach ${selectedDocuments.length} Document(s)`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
