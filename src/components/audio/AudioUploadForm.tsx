import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useCreateAudioTrack } from "@/hooks/use-audio-tracks";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

export function AudioUploadForm({ onSuccess }: { onSuccess?: () => void }) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [series, setSeries] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const createTrack = useCreateAudioTrack();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "mp3";
      const storageKey = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("audio").upload(storageKey, file, {
        contentType: file.type || "audio/mpeg",
      });
      if (uploadError) throw uploadError;

      // Get duration from file
      let duration_seconds: number | null = null;
      try {
        const url = URL.createObjectURL(file);
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

      const { data: { user } } = await supabase.auth.getUser();

      await createTrack.mutateAsync({
        title: title.trim(),
        artist: artist.trim() || null,
        series: series.trim() || null,
        description: description.trim() || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        visibility,
        storage_key: storageKey,
        duration_seconds,
        created_by: user?.id || null,
        date_published: new Date().toISOString().split("T")[0],
      } as any);

      toast.success("Track uploaded");
      setTitle(""); setArtist(""); setSeries(""); setDescription(""); setTags(""); setFile(null);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div>
        <Label>MP3 File *</Label>
        <Input type="file" accept="audio/mpeg,audio/mp3,.mp3" onChange={(e) => setFile(e.target.files?.[0] || null)} />
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
      <Button type="submit" disabled={uploading || !file || !title.trim()}>
        {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
        Upload Track
      </Button>
    </form>
  );
}
