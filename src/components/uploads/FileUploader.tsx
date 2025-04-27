
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useFileUpload } from "@/hooks/use-file-upload";
import { Textarea } from "@/components/ui/textarea";
import { Upload, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";

export function FileUploader() {
  const { user } = useAuth();
  const { uploadFile, isUploading } = useFileUpload();
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Simulate progress updates
  const simulateProgress = () => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prevProgress => {
        if (prevProgress >= 95) {
          clearInterval(interval);
          return prevProgress;
        }
        return prevProgress + 5;
      });
    }, 200);

    return () => clearInterval(interval);
  };

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Reset any previous errors
    setError(null);

    // Check if user is logged in
    if (!user) {
      setError("You must be logged in to upload files");
      toast.error("Authentication required", {
        description: "Please sign in to upload files"
      });
      return;
    }

    try {
      const cleanupProgress = simulateProgress();
      
      // Log the file details
      console.log("Attempting to upload file:", {
        name: file.name,
        size: file.size,
        type: file.type
      });
      
      await uploadFile(file, notes);
      setProgress(100);
      setNotes("");
      
      // Show notification for new upload
      toast('New file uploaded', {
        description: `${file.name} has been uploaded and is ready for review.`
      });
      
      // Clean up the progress simulation
      cleanupProgress();

      // Reset progress after a delay
      setTimeout(() => setProgress(0), 2000);
    } catch (error: any) {
      console.error("Upload failed:", error);
      setError(error.message || "Upload failed. Please try again.");
      toast.error('Upload failed', {
        description: 'There was an error uploading your file. Please try again.'
      });
      setProgress(0);
    }
  }, [uploadFile, notes, user]);

  return (
    <div className="space-y-4 p-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
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
          disabled={isUploading || !user}
          className="w-full sm:w-auto"
        >
          <Upload className="mr-2 h-4 w-4" />
          {isUploading ? "Uploading..." : "Upload File"}
        </Button>
      </div>

      {(isUploading || progress > 0) && (
        <Progress value={progress} className="w-full" />
      )}
      
      {!user && (
        <p className="text-sm text-muted-foreground">
          You must be logged in to upload files.
        </p>
      )}
    </div>
  );
}
