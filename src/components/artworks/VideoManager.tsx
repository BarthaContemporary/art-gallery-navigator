
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, ExternalLink, Star, StarOff, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface VideoManagerProps {
  artworkId: string;
}

export function VideoManager({ artworkId }: VideoManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);

  const { data: videos, isLoading } = useQuery({
    queryKey: ['artwork-videos', artworkId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('artwork_videos')
        .select('*')
        .eq('artwork_id', artworkId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!artworkId,
  });

  const deleteVideo = async (videoId: string) => {
    setDeletingId(videoId);
    try {
      const video = videos?.find(v => v.id === videoId);
      if (!video) return;

      // Delete from database
      const { error: dbError } = await supabase
        .from('artwork_videos')
        .delete()
        .eq('id', videoId);

      if (dbError) throw dbError;

      // Delete from storage
      const fileName = video.file_url.split('/').pop();
      if (fileName) {
        await supabase.storage
          .from('artwork-videos')
          .remove([`${artworkId}/${fileName}`]);
      }

      toast({
        title: "Success",
        description: "Video deleted successfully",
      });

      queryClient.invalidateQueries({ queryKey: ['artwork-videos', artworkId] });
    } catch (error: any) {
      console.error("Error deleting video:", error);
      toast({
        title: "Error",
        description: "Failed to delete video",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const setPrimaryVideo = async (videoId: string) => {
    setSettingPrimaryId(videoId);
    try {
      const { error } = await supabase
        .from('artwork_videos')
        .update({ is_primary: true })
        .eq('id', videoId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Primary video updated",
      });

      queryClient.invalidateQueries({ queryKey: ['artwork-videos', artworkId] });
    } catch (error: any) {
      console.error("Error setting primary video:", error);
      toast({
        title: "Error",
        description: "Failed to update primary video",
        variant: "destructive",
      });
    } finally {
      setSettingPrimaryId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "secondary",
      uploading: "default",
      completed: "default",
      failed: "destructive"
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {status}
      </Badge>
    );
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading videos...</div>;
  }

  if (!videos || videos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No videos uploaded yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {videos.map((video) => (
        <Card key={video.id} className="relative">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base truncate">{video.file_name}</CardTitle>
              <div className="flex items-center gap-2">
                {video.is_primary && <Badge variant="default">Primary</Badge>}
                {getStatusBadge(video.upload_status)}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              <p>Size: {video.file_size ? `${(video.file_size / 1024 / 1024).toFixed(1)} MB` : 'Unknown'}</p>
              {video.duration_seconds && (
                <p>Duration: {Math.floor(video.duration_seconds / 60)}:{(video.duration_seconds % 60).toString().padStart(2, '0')}</p>
              )}
              <p>Uploaded: {new Date(video.created_at).toLocaleDateString()}</p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {!video.is_primary && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPrimaryVideo(video.id)}
                  disabled={settingPrimaryId === video.id}
                >
                  {settingPrimaryId === video.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Star className="h-4 w-4" />
                  )}
                  Set Primary
                </Button>
              )}
              
              {video.vimeo_url && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(video.vimeo_url!, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                  View on Vimeo
                </Button>
              )}
              
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteVideo(video.id)}
                disabled={deletingId === video.id}
              >
                {deletingId === video.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
