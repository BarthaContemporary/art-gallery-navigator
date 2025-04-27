
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
import { toast } from "sonner";

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
  const [fileToDelete, setFileToDelete] = useState<{ id: string; fileName: string } | null>(null);

  const { data: uploads, isLoading, refetch, error } = useQuery({
    queryKey: ['uploads'],
    queryFn: async () => {
      try {
        console.log("Fetching uploads data...");
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
        
        if (error) {
          console.error("Error fetching uploads:", error);
          throw error;
        }
        
        console.log("Uploads data fetched:", data);
        return data as UploadData[];
      } catch (err) {
        console.error("Failed to fetch uploads:", err);
        throw err;
      }
    },
  });

  const handleDelete = async () => {
    if (!fileToDelete) return;

    try {
      // Extract the filename from the URL to get the storage path
      const url = new URL(fileToDelete.fileName);
      const filePath = url.pathname.split('/').pop() || fileToDelete.fileName;
      
      console.log("Deleting file from storage:", filePath);
      
      // Delete from storage
      const { error } = await supabase
        .storage
        .from('large-uploads')
        .remove([filePath]);

      if (error) {
        console.error("Storage deletion error:", error);
        throw error;
      }

      console.log("File deleted from storage, now removing from database");
      
      // Delete from database
      // Using 'as any' to bypass TypeScript errors temporarily
      const { error: dbError } = await (supabase
        .from('uploads' as any)
        .delete()
        .eq('id', fileToDelete.id) as any);

      if (dbError) {
        console.error("Database deletion error:", dbError);
        throw dbError;
      }

      toast.success("File deleted", {
        description: "The file has been successfully deleted."
      });

      refetch();
    } catch (error: any) {
      console.error("Delete operation failed:", error);
      toast.error("Failed to delete file", {
        description: error.message || "Please try again or contact support."
      });
    } finally {
      setFileToDelete(null);
    }
  };

  if (isLoading) {
    return <div className="py-8 text-center">Loading uploads...</div>;
  }

  if (error) {
    return (
      <div className="py-8 text-center text-destructive">
        Error loading uploads. Please try refreshing the page.
      </div>
    );
  }

  if (!uploads || uploads.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">No files have been uploaded yet.</div>;
  }

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
              <TableCell className="max-w-[200px] truncate">{upload.file_name}</TableCell>
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
                      fileName: upload.file_url
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
