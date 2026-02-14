import { useParams } from "react-router-dom";
import { useAudioTrackBySlug, getAudioPublicUrl } from "@/hooks/use-audio-tracks";
import { MicroPlayer } from "@/components/audio/MicroPlayer";
import { Loader2, Copy, Check } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function AudioTrackDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: track, isLoading } = useAudioTrackBySlug(slug);
  const [copied, setCopied] = useState(false);

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!track) return <div className="text-center py-20 text-muted-foreground">Track not found.</div>;

  const audioUrl = track.storage_key ? getAudioPublicUrl(track.storage_key) : undefined;
  const embedCode = `<iframe src="${window.location.origin}/embed/audio/track/${track.slug}" width="100%" height="56" frameborder="0" allow="autoplay" style="border-radius:8px;"></iframe>`;

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Helmet>
        <title>{track.title} — Audio</title>
        <meta name="description" content={track.description || `Listen to ${track.title}`} />
      </Helmet>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex gap-6 mb-6">
          {track.cover_image_url && (
            <img src={track.cover_image_url} alt={track.title} className="w-32 h-32 rounded-xl object-cover" loading="lazy" />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground">{track.title}</h1>
            {track.artist && <p className="text-muted-foreground mt-1">{track.artist}</p>}
            {track.series && <p className="text-sm text-muted-foreground">{track.series}</p>}
            {track.tags?.length ? (
              <div className="flex gap-1 mt-3 flex-wrap">
                {track.tags.map((t) => (
                  <span key={t} className="text-xs bg-secondary px-2 py-0.5 rounded-full text-secondary-foreground">{t}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <MicroPlayer src={audioUrl} title={track.title} artist={track.artist || undefined} coverUrl={track.cover_image_url || undefined} />

        {track.description && (
          <p className="text-sm text-muted-foreground mt-6 leading-relaxed">{track.description}</p>
        )}

        <div className="mt-8 border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-2">Embed this track</h2>
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap break-all text-muted-foreground">{embedCode}</pre>
          <Button variant="outline" size="sm" className="mt-2" onClick={copyEmbed}>
            {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
    </>
  );
}
