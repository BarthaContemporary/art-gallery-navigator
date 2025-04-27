
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useFileUpload } from "@/hooks/use-file-upload";
import { Textarea } from "@/components/ui/textarea";
import { Upload } from "lucide-react";

export function FileUploader() {
  const { uploadFile, isUploading } = useFileUpload();
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState(0);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await uploadFile(file, notes);
      setNotes("");
      setProgress(0);
    } catch (error) {
      console.error("Upload failed:", error);
    }
  }, [uploadFile, notes]);

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <Textarea
          placeholder="Add notes about this upload (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[100px]"
        />
      </div>
      
      <div className="flex items-center gap-4">
        <input
          type="file"
          id="file-upload"
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading}
        />
        <Button
          onClick={() => document.getElementById("file-upload")?.click()}
          disabled={isUploading}
        >
          <Upload className="mr-2 h-4 w-4" />
          {isUploading ? "Uploading..." : "Upload File"}
        </Button>
      </div>

      {isUploading && (
        <Progress value={progress} className="w-full" />
      )}
    </div>
  );
}
