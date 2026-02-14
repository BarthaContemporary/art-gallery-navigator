import { useAudioPlayer } from "@/hooks/use-audio-player";
import { Play, Pause } from "lucide-react";

function formatTime(s: number) {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

interface MicroPlayerProps {
  src?: string;
  title?: string;
  artist?: string;
  coverUrl?: string;
}

export function MicroPlayer({ src, title, artist, coverUrl }: MicroPlayerProps) {
  const { isPlaying, currentTime, duration, togglePlay, seek } = useAudioPlayer(src);

  return (
    <div
      role="region"
      aria-label="Audio player"
      className="micro-player"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        height: "56px",
        padding: "0 12px",
        background: "var(--audio-player-bg, #1a1a1a)",
        color: "var(--audio-player-fg, #f5f5f5)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: "13px",
        borderRadius: "8px",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {coverUrl && (
        <img
          src={coverUrl}
          alt=""
          loading="lazy"
          style={{ width: 36, height: 36, borderRadius: 4, objectFit: "cover", flexShrink: 0 }}
        />
      )}
      <button
        onClick={togglePlay}
        onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); togglePlay(); } }}
        aria-label={isPlaying ? "Pause" : "Play"}
        style={{
          background: "none",
          border: "none",
          color: "var(--audio-player-accent, #4f9eff)",
          cursor: "pointer",
          padding: 4,
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
      </button>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        {(title || artist) && (
          <div style={{ display: "flex", gap: 6, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
            {title && <span style={{ fontWeight: 600, fontSize: 12 }}>{title}</span>}
            {artist && <span style={{ opacity: 0.6, fontSize: 12 }}>{artist}</span>}
          </div>
        )}
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek"
          style={{
            width: "100%",
            height: 4,
            cursor: "pointer",
            accentColor: "var(--audio-player-accent, #4f9eff)",
          }}
        />
      </div>
      <span style={{ fontSize: 11, opacity: 0.7, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
}
