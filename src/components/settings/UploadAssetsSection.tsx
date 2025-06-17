
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, ChevronDown, Image, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UploadAssetsSection() {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleImageUpload = async () => {
    setIsUploading(true);
    try {
      // Create file input programmatically
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          // Handle image upload logic here
          toast({
            title: "Images uploaded",
            description: `Successfully uploaded ${files.length} image(s).`,
          });
        }
      };
      input.click();
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDocumentUpload = async () => {
    setIsUploading(true);
    try {
      // Create file input programmatically
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,.doc,.docx,.txt';
      input.multiple = true;
      input.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          // Handle document upload logic here
          toast({
            title: "Documents uploaded",
            description: `Successfully uploaded ${files.length} document(s).`,
          });
        }
      };
      input.click();
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Assets
          </CardTitle>
          <CardDescription>
            Upload images, documents, and other files to your gallery
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={isUploading} className="w-full justify-between">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  {isUploading ? "Uploading..." : "Upload Files"}
                </div>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Upload Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleImageUpload}
                disabled={isUploading}
                className="cursor-pointer"
              >
                <Image className="h-4 w-4 mr-2" />
                Upload Images
                <span className="ml-auto text-xs text-muted-foreground">JPG, PNG, GIF</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleDocumentUpload}
                disabled={isUploading}
                className="cursor-pointer"
              >
                <FileText className="h-4 w-4 mr-2" />
                Upload Documents
                <span className="ml-auto text-xs text-muted-foreground">PDF, DOC, TXT</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>
    </div>
  );
}
