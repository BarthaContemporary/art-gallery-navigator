import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAudioCollections,
  useCreateAudioCollection,
  useDeleteAudioCollection,
  useAudioCollectionItems,
  useAddTrackToCollection,
  useRemoveTrackFromCollection,
} from "@/hooks/use-audio-collections";
import { useAudioTracks, type AudioTrack } from "@/hooks/use-audio-tracks";
import { toast } from "sonner";
import { Trash2, Plus, Music } from "lucide-react";

export function AudioCollectionManager() {
  const { data: collections } = useAudioCollections();
  const createCollection = useCreateAudioCollection();
  const deleteCollection = useDeleteAudioCollection();
  const [newTitle, setNewTitle] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      await createCollection.mutateAsync({ title: newTitle.trim() });
      setNewTitle("");
      toast.success("Collection created");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Label>New Collection</Label>
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Collection title" />
        </div>
        <Button onClick={handleCreate} disabled={!newTitle.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Create
        </Button>
      </div>

      <div className="space-y-3">
        {collections?.map((col) => (
          <div key={col.id} className="border border-border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <button
                className="font-medium text-sm text-foreground hover:underline text-left"
                onClick={() => setSelectedCollectionId(selectedCollectionId === col.id ? null : col.id)}
              >
                {col.title}
              </button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (confirm("Delete this collection?")) deleteCollection.mutate(col.id);
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            {selectedCollectionId === col.id && <CollectionItems collectionId={col.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function CollectionItems({ collectionId }: { collectionId: string }) {
  const { data: items } = useAudioCollectionItems(collectionId);
  const { data: allTracks } = useAudioTracks();
  const addTrack = useAddTrackToCollection();
  const removeTrack = useRemoveTrackFromCollection();
  const [addingTrackId, setAddingTrackId] = useState("");

  const existingTrackIds = new Set(items?.map((i) => i.track_id));
  const availableTracks = allTracks?.filter((t) => !existingTrackIds.has(t.id)) || [];

  const handleAdd = async () => {
    if (!addingTrackId) return;
    const nextPos = (items?.length || 0) + 1;
    try {
      await addTrack.mutateAsync({ collection_id: collectionId, track_id: addingTrackId, position: nextPos });
      setAddingTrackId("");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-2 mt-2">
      {items?.map((item) => (
        <div key={item.id} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1">
          <Music className="h-3 w-3 text-muted-foreground" />
          <span className="flex-1 truncate">{(item as any).audio_tracks?.title || item.track_id}</span>
          <span className="text-xs text-muted-foreground">#{item.position}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeTrack.mutate(item.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <select
          className="flex-1 h-9 rounded-lg bg-secondary/80 px-3 text-sm"
          value={addingTrackId}
          onChange={(e) => setAddingTrackId(e.target.value)}
        >
          <option value="">Add track...</option>
          {availableTracks.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        <Button size="sm" onClick={handleAdd} disabled={!addingTrackId}>Add</Button>
      </div>
    </div>
  );
}
