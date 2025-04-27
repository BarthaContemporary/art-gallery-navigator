
import { useState } from "react";
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
import { DeleteUploadDialog } from "./components/DeleteUploadDialog";
import { useUploadsList } from "./hooks/use-uploads-list";
import { UploadData } from "./types";

export function UploadedFilesList() {
  const [fileToDelete, setFileToDelete] = useState<{ id: string; fileName: string } | null>(null);
  const { uploads, isLoading, refetch, error, userProfiles } = useUploadsList();

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
              <TableCell>{userProfiles[upload.uploaded_by] || 'Unknown'}</TableCell>
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

      <DeleteUploadDialog 
        fileToDelete={fileToDelete}
        onOpenChange={(open) => !open && setFileToDelete(null)}
        onSuccess={refetch}
      />
    </>
  );
}
