import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAudioTrackBySlug, getAudioPublicUrl } from "@/hooks/use-audio-tracks";
import { MicroPlayer } from "@/components/audio/MicroPlayer";

export default function AudioTrackEmbed() {
  const { slug } = useParams<{ slug: string }>();
  const { data: track } = useAudioTrackBySlug(slug);

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.overflow = "hidden";
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
  }, []);

  if (!track) return <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#888" }}>Loading...</div>;

  const audioUrl = track.storage_key ? getAudioPublicUrl(track.storage_key) : undefined;

  return (
    <div style={{ padding: 0, margin: 0, background: "transparent" }}>
      <MicroPlayer src={audioUrl} title={track.title} artist={track.artist || undefined} coverUrl={track.cover_image_url || undefined} />
    </div>
  );
}
