import { useParams } from "react-router-dom";
import { useAudioCollectionBySlug, useAudioCollectionItems } from "@/hooks/use-audio-collections";
import { getAudioPublicUrl } from "@/hooks/use-audio-tracks";
import { MicroPlayer } from "@/components/audio/MicroPlayer";
import { Loader2 } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useState } from "react";

export default function AudioCollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: collection, isLoading } = useAudioCollectionBySlug(slug);
  const { data: items } = useAudioCollectionItems(collection?.id);
  const [activeIndex, setActiveIndex] = useState(0);

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!collection) return <div className="text-center py-20 text-muted-foreground">Collection not found.</div>;

  const activeTrack = items?.[activeIndex]?.audio_tracks as any;
  const audioUrl = activeTrack?.storage_key ? getAudioPublicUrl(activeTrack.storage_key) : undefined;

  return (
    <>
      <Helmet>
        <title>{collection.title} — Audio Collection</title>
        <meta name="description" content={collection.description || `Audio collection: ${collection.title}`} />
      </Helmet>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">{collection.title}</h1>
        {collection.description && <p className="text-muted-foreground mb-6">{collection.description}</p>}

        {activeTrack && (
          <MicroPlayer
            src={audioUrl}
            title={activeTrack.title}
            artist={activeTrack.artist || undefined}
            coverUrl={activeTrack.cover_image_url || undefined}
          />
        )}

        <div className="mt-6 space-y-1">
          {items?.map((item, i) => {
            const track = item.audio_tracks as any;
            if (!track) return null;
            return (
              <button
                key={item.id}
                onClick={() => setActiveIndex(i)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  i === activeIndex ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
                }`}
              >
                <span className="text-xs text-muted-foreground w-5">{item.position}</span>
                <span className="flex-1 truncate">{track.title}</span>
                {track.artist && <span className="text-xs text-muted-foreground">{track.artist}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
