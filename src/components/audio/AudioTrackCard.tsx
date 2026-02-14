import type { AudioTrack } from "@/hooks/use-audio-tracks";
import { Play, Lock } from "lucide-react";
import { Link } from "react-router-dom";

export function AudioTrackCard({ track }: { track: AudioTrack }) {
  return (
    <Link
      to={`/audio/tracks/${track.slug}`}
      className="group block rounded-xl border border-border bg-card p-3 hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-square rounded-lg overflow-hidden bg-muted mb-3">
        {track.cover_image_url ? (
          <img src={track.cover_image_url} alt={track.title} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        {track.visibility === "private" && (
          <div className="absolute top-2 right-2 bg-background/80 rounded-full p-1">
            <Lock className="h-3 w-3" />
          </div>
        )}
      </div>
      <h3 className="font-semibold text-sm truncate text-foreground">{track.title}</h3>
      {track.artist && <p className="text-xs text-muted-foreground truncate">{track.artist}</p>}
      {track.tags?.length ? (
        <div className="flex gap-1 mt-2 flex-wrap">
          {track.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-full text-secondary-foreground">{t}</span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}
