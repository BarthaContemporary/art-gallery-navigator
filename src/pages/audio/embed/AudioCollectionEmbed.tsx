import { useParams } from "react-router-dom";
import { useAudioCollectionBySlug, useAudioCollectionItems } from "@/hooks/use-audio-collections";
import { getAudioPublicUrl } from "@/hooks/use-audio-tracks";
import { MicroPlayer } from "@/components/audio/MicroPlayer";
import { useState } from "react";

export default function AudioCollectionEmbed() {
  const { slug } = useParams<{ slug: string }>();
  const { data: collection } = useAudioCollectionBySlug(slug);
  const { data: items } = useAudioCollectionItems(collection?.id);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showList, setShowList] = useState(false);

  if (!collection) return <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#888" }}>Loading...</div>;

  const activeTrack = items?.[activeIndex]?.audio_tracks as any;
  const audioUrl = activeTrack?.storage_key ? getAudioPublicUrl(activeTrack.storage_key) : undefined;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "var(--audio-player-bg, #1a1a1a)", color: "var(--audio-player-fg, #f5f5f5)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <MicroPlayer src={audioUrl} title={activeTrack?.title} artist={activeTrack?.artist || undefined} />
        </div>
        {items && items.length > 1 && (
          <button
            onClick={() => setShowList(!showList)}
            style={{ padding: "0 12px", height: 56, background: "none", border: "none", color: "var(--audio-player-accent, #4f9eff)", cursor: "pointer", fontSize: 11 }}
          >
            {showList ? "Hide" : `${items.length} tracks`}
          </button>
        )}
      </div>
      {showList && items && (
        <div style={{ maxHeight: 200, overflowY: "auto", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          {items.map((item, i) => {
            const track = item.audio_tracks as any;
            if (!track) return null;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveIndex(i); setShowList(false); }}
                style={{
                  display: "flex",
                  width: "100%",
                  padding: "8px 12px",
                  background: i === activeIndex ? "rgba(79,158,255,0.15)" : "transparent",
                  border: "none",
                  color: "inherit",
                  fontSize: 12,
                  cursor: "pointer",
                  textAlign: "left",
                  gap: 8,
                }}
              >
                <span style={{ opacity: 0.5, width: 20 }}>{item.position}</span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.title}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
