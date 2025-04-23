
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useArtworks } from "@/hooks/use-artworks";
import { z } from "zod";

const uploadFormSchema = z.object({
  file: z.instanceof(File),
  type: z.string().min(1, "Document type is required"),
  description: z.string().optional(),
  artwork_id: z.string().optional(),
  artist_id: z.string().optional(),
});

type UploadFormData = z.infer<typeof uploadFormSchema>;

export function UploadDocumentDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: artworks } = useArtworks();
  
  const form = useForm<UploadFormData>({
    defaultValues: {
      description: "",
      artwork_id: "",
      artist_id: "",
    }
  });
  
  const handleUpload = async (data: UploadFormData) => {
    try {
      const file = data.file;
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const fileName = `${timestamp}_${randomStr}.${fileExt}`;

      // Upload file to storage
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) {
        if (uploadError.message.includes("buckets")) {
          toast.error("Document storage not available. Contact administrator.", {
            description: "You don't have permission to use document storage"
          });
        } else {
          toast.error("Upload failed: " + uploadError.message);
        }
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // Create document record
      const { error: insertError } = await supabase
        .from('documents')
        .insert({
          file_name: file.name,
          file_url: publicUrl,
          type: data.type,
          description: data.description || null,
          artwork_id: data.artwork_id || null,
          artist_id: data.artist_id || null,
        });

      if (insertError) {
        toast.error("Failed to save document record: " + insertError.message);
        throw insertError;
      }

      toast.success("Document uploaded successfully");
      setOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["documents"] });

    } catch (error) {
      console.error('Upload error:', error);
      // Toast is already shown in the error handling above
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Upload Document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleUpload)} className="space-y-4">
            <FormField
              control={form.control}
              name="file"
              render={({ field: { onChange, value, ...rest } }) => (
                <FormItem>
                  <FormLabel>File</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onChange(file);
                      }}
                      {...rest}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Type</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="">Select type...</option>
                      <option value="condition report">Condition Report</option>
                      <option value="invoice">Invoice</option>
                      <option value="provenance">Provenance</option>
                      <option value="CoA">Certificate of Authenticity</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="artwork_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Related Artwork</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="">Select artwork...</option>
                      {artworks?.map((artwork) => (
                        <option key={artwork.id} value={artwork.id}>
                          {artwork.title}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">
              <Upload className="mr-2 h-4 w-4" /> Upload
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
