
import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UploadFormData, uploadFormSchema } from "@/components/documents/upload-document-schema";
import { zodResolver } from "@hookform/resolvers/zod";

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export function useEnhancedDocumentUpload() {
  const [open, setOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  
  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      description: "",
      artwork_id: "_none",
      collection_id: "_none",
      artist_id: "",
      type: "",
    }
  });

  const resetUploadState = useCallback(() => {
    setUploadStatus('idle');
    setUploadProgress(0);
    setUploadError(null);
  }, []);

  const validateSelection = useCallback((data: UploadFormData) => {
    const hasArtwork = data.artwork_id && data.artwork_id !== "_none";
    const hasCollection = data.collection_id && data.collection_id !== "_none";
    const hasArtist = data.artist_id && data.artist_id !== "_none" && data.artist_id !== "";
    
    const selectedEntities = [hasArtwork, hasCollection, hasArtist].filter(Boolean);
    
    if (selectedEntities.length === 0) {
      throw new Error("Please attach document to an artwork, collection, or artist");
    }
    
    if (selectedEntities.length > 1) {
      throw new Error("Document can only be attached to one entity: artwork, collection, or artist");
    }

    return { hasArtwork, hasCollection, hasArtist };
  }, []);

  const simulateProgress = useCallback(() => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return prev;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  const handleUpload = useCallback(async (data: UploadFormData) => {
    if (!data.file) {
      toast.error("Please select a file to upload");
      return;
    }

    try {
      resetUploadState();
      setUploadStatus('uploading');
      
      // Validate selection
      const { hasArtwork, hasCollection, hasArtist } = validateSelection(data);
      
      // Start progress simulation
      const cleanupProgress = simulateProgress();
      
      // Generate unique filename
      const file = data.file;
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const fileName = `${timestamp}_${randomStr}.${fileExt}`;

      // Upload to storage
      const uploadResult = await supabase.storage
        .from('documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });
          
      if (uploadResult.error) {
        throw new Error(`Upload failed: ${uploadResult.error.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // Update progress
      setUploadProgress(95);

      // Create document record
      const documentRecord = {
        file_name: file.name,
        file_url: publicUrl,
        type: data.type,
        description: data.description || null,
        artwork_id: hasArtwork ? data.artwork_id : null,
        collection_id: hasCollection ? data.collection_id : null,
        artist_id: hasArtist ? data.artist_id : null
      };

      const insertResult = await supabase
        .from('documents')
        .insert(documentRecord);

      if (insertResult.error) {
        // Clean up uploaded file if database insert fails
        await supabase.storage.from('documents').remove([fileName]);
        throw new Error(`Failed to save document record: ${insertResult.error.message}`);
      }

      // Complete progress
      setUploadProgress(100);
      setUploadStatus('success');
      cleanupProgress();
      
      toast.success("Document uploaded successfully");
      
      // Reset form and close dialog
      setTimeout(() => {
        setOpen(false);
        form.reset({
          description: "",
          artwork_id: "_none",
          collection_id: "_none",
          artist_id: "",
          type: "",
          file: undefined
        });
        resetUploadState();
        
        // Refresh documents list
        queryClient.invalidateQueries({ queryKey: ["documents-simplified"] });
      }, 1000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Upload failed";
      console.error('Upload error:', error);
      setUploadStatus('error');
      setUploadError(errorMessage);
      toast.error(errorMessage);
    }
  }, [form, queryClient, resetUploadState, validateSelection, simulateProgress]);

  const handleRetry = useCallback(() => {
    const formData = form.getValues();
    handleUpload(formData);
  }, [form, handleUpload]);

  return {
    form,
    open,
    setOpen,
    handleUpload,
    handleRetry,
    uploadStatus,
    uploadProgress,
    uploadError,
    resetUploadState
  };
}
