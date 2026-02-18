import { useState, useEffect } from "react";
import { AudioTrack, useUpdateAudioTrack, getAudioPublicUrl } from "@/hooks/use-audio-tracks";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AudioEditDialogProps {
  track: AudioTrack | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AudioEditDialog({ track, open, onOpenChange }: AudioEditDialogProps) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [series, setSeries] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const updateTrack = useUpdateAudioTrack();

  useEffect(() => {
    if (track) {
      setTitle(track.title || "");
      setArtist(track.artist || "");
      setSeries(track.series || "");
      setDescription(track.description || "");
      setTags(track.tags?.join(", ") || "");
      setVisibility(track.visibility || "public");
      setNewFile(null);
    }
  }, [track]);

  if (!track) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    try {
      let storage_key = track.storage_key;
      let duration_seconds = track.duration_seconds;

      // Replace audio file if a new one was selected
      if (newFile) {
        const ext = newFile.name.split(".").pop() || "mp3";
        const newKey = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage.from("audio").upload(newKey, newFile, {
          contentType: newFile.type || "audio/mpeg",
        });
        if (uploadError) throw uploadError;

        // Get new duration
        try {
          const url = URL.createObjectURL(newFile);
          const audio = new Audio(url);
          await new Promise<void>((resolve) => {
            audio.addEventListener("loadedmetadata", () => {
              duration_seconds = Math.round(audio.duration);
              URL.revokeObjectURL(url);
              resolve();
            });
            audio.addEventListener("error", () => { URL.revokeObjectURL(url); resolve(); });
          });
        } catch {}

        // Delete old file
        if (track.storage_key) {
          await supabase.storage.from("audio").remove([track.storage_key]);
        }

        storage_key = newKey;
      }

      await updateTrack.mutateAsync({
        id: track.id,
        title: title.trim(),
        artist: artist.trim() || null,
        series: series.trim() || null,
        description: description.trim() || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        visibility,
        storage_key,
        duration_seconds,
      } as any);

      toast.success("Track updated");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Track</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label>Replace Audio File</Label>
            <div className="flex items-center gap-2">
              <Input type="file" accept="audio/mpeg,audio/mp3,.mp3" onChange={(e) => setNewFile(e.target.files?.[0] || null)} />
              {newFile && (
                <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" /> Replacing
                </span>
              )}
            </div>
            {!newFile && track.storage_key && (
              <p className="text-xs text-muted-foreground mt-1">Current file will be kept if no new file is selected.</p>
            )}
          </div>
          <div>
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Artist</Label>
              <Input value={artist} onChange={(e) => setArtist(e.target.value)} />
            </div>
            <div>
              <Label>Series</Label>
              <Input value={series} onChange={(e) => setSeries(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <textarea
              className="flex w-full rounded-[10px] bg-secondary/80 px-4 py-2 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label>Tags (comma-separated)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ambient, podcast, interview" />
          </div>
          <div>
            <Label>Visibility</Label>
            <select
              className="flex h-11 w-full rounded-[10px] bg-secondary/80 px-4 py-2 text-[15px]"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !title.trim()}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
