
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

// Define a type for the upload data
interface UploadData {
  id: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  created_at: string;
  uploaded_by: string;
  notes?: string;
  profiles?: {
    display_name: string;
  };
}

export function UploadedFilesList() {
  const { toast } = useToast();
  const [fileToDelete, setFileToDelete] = useState<{ id: string; fileName: string } | null>(null);

  const { data: uploads, isLoading, refetch } = useQuery({
    queryKey: ['uploads'],
    queryFn: async () => {
      // Using 'as any' to bypass TypeScript errors temporarily
      const { data, error } = await (supabase
        .from('uploads' as any)
        .select(`
          id,
          file_name,
          file_url,
          file_size,
          created_at,
          uploaded_by,
          notes,
          profiles(display_name)
        `)
        .order('created_at', { ascending: false }) as any);
      
      if (error) throw error;
      return data as UploadData[];
    },
  });

  const handleDelete = async () => {
    if (!fileToDelete) return;

    try {
      // Get the file path from the storage URL
      const filePath = fileToDelete.fileName;

      // Delete from storage
      const { error } = await supabase
        .storage
        .from('large-uploads')
        .remove([filePath]);

      if (error) throw error;

      // Delete from database
      // Using 'as any' to bypass TypeScript errors temporarily
      const { error: dbError } = await (supabase
        .from('uploads' as any)
        .delete()
        .eq('id', fileToDelete.id) as any);

      if (dbError) throw dbError;

      toast({
        title: "File deleted",
        description: "The file has been successfully deleted.",
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete the file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setFileToDelete(null);
    }
  };

  if (isLoading) return <div>Loading uploads...</div>;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Uploaded At</TableHead>
            <TableHead>File Name</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {uploads?.map((upload: UploadData) => (
            <TableRow key={upload.id}>
              <TableCell>{upload.profiles?.display_name || 'Unknown'}</TableCell>
              <TableCell>{new Date(upload.created_at).toLocaleDateString()}</TableCell>
              <TableCell>{upload.file_name}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                  >
                    <a href={upload.file_url} download target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFileToDelete({ 
                      id: upload.id, 
                      fileName: upload.file_name 
                    })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the file. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
