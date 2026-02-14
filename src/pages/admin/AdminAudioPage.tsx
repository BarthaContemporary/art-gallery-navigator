import { useState } from "react";
import { useAudioTracks, useDeleteAudioTrack, getAudioPublicUrl } from "@/hooks/use-audio-tracks";
import { AudioUploadForm } from "@/components/audio/AudioUploadForm";
import { AudioCollectionManager } from "@/components/audio/AudioCollectionManager";
import { MicroPlayer } from "@/components/audio/MicroPlayer";
import { Button } from "@/components/ui/button";
import { Trash2, Music, FolderOpen, Plus } from "lucide-react";
import { Helmet } from "react-helmet-async";

export default function AdminAudioPage() {
  const { data: tracks } = useAudioTracks();
  const deleteTrack = useDeleteAudioTrack();
  const [tab, setTab] = useState<"tracks" | "upload" | "collections">("tracks");
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);

  const previewTrack = tracks?.find((t) => t.id === previewTrackId);
  const previewUrl = previewTrack?.storage_key ? getAudioPublicUrl(previewTrack.storage_key) : undefined;

  return (
    <>
      <Helmet><title>Audio Management — Admin</title></Helmet>
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">Audio Library</h1>

        <div className="flex gap-2 mb-6">
          <Button variant={tab === "tracks" ? "default" : "outline"} size="sm" onClick={() => setTab("tracks")}>
            <Music className="h-4 w-4 mr-1" /> Tracks
          </Button>
          <Button variant={tab === "upload" ? "default" : "outline"} size="sm" onClick={() => setTab("upload")}>
            <Plus className="h-4 w-4 mr-1" /> Upload
          </Button>
          <Button variant={tab === "collections" ? "default" : "outline"} size="sm" onClick={() => setTab("collections")}>
            <FolderOpen className="h-4 w-4 mr-1" /> Collections
          </Button>
        </div>

        {previewTrack && (
          <div className="mb-6">
            <MicroPlayer src={previewUrl} title={previewTrack.title} artist={previewTrack.artist || undefined} />
          </div>
        )}

        {tab === "upload" && <AudioUploadForm onSuccess={() => setTab("tracks")} />}

        {tab === "collections" && <AudioCollectionManager />}

        {tab === "tracks" && (
          <div className="space-y-2">
            {tracks?.length === 0 && <p className="text-muted-foreground text-sm">No tracks yet. Upload your first track.</p>}
            {tracks?.map((track) => (
              <div key={track.id} className="flex items-center gap-3 border border-border rounded-lg p-3">
                {track.cover_image_url && (
                  <img src={track.cover_image_url} alt="" className="w-10 h-10 rounded object-cover" loading="lazy" />
                )}
                <div className="flex-1 min-w-0">
                  <button className="font-medium text-sm text-foreground hover:underline truncate block" onClick={() => setPreviewTrackId(previewTrackId === track.id ? null : track.id)}>
                    {track.title}
                  </button>
                  <p className="text-xs text-muted-foreground truncate">{track.artist || "—"} · {track.visibility}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { if (confirm(`Delete "${track.title}"?`)) deleteTrack.mutate(track.id); }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
