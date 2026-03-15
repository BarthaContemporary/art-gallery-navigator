import { useRef, useEffect, useState } from "react";

interface StripNode {
  id: string;
  name: string;
  thumbnailUrl?: string | null;
}

interface TourNodeStripProps {
  nodes: StripNode[];
  currentIndex: number;
  onNodeSelect: (index: number) => void;
  className?: string;
}

/**
 * Horizontal scrollable thumbnail strip for node navigation.
 * Matterport-style bottom nav bar.
 */
export function TourNodeStrip({ nodes, currentIndex, onNodeSelect, className = "" }: TourNodeStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Auto-scroll to keep current node visible
  useEffect(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const child = container.children[currentIndex] as HTMLElement | undefined;
    if (child) {
      child.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [currentIndex]);

  if (nodes.length <= 1) return null;

  return (
    <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-[80vw] ${className}`}>
      <div
        ref={scrollRef}
        className="flex items-end gap-2 px-3 py-2.5 bg-black/60 backdrop-blur-md rounded-xl overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {nodes.map((node, idx) => {
          const isActive = idx === currentIndex;
          const isHovered = idx === hoveredIdx;

          return (
            <button
              key={node.id}
              onClick={() => onNodeSelect(idx)}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="relative flex-shrink-0 group"
            >
              <div
                className={`rounded-lg overflow-hidden transition-all duration-200 ${
                  isActive
                    ? "w-16 h-16 ring-2 ring-white shadow-lg scale-105"
                    : "w-12 h-12 ring-1 ring-white/20 opacity-70 hover:opacity-100 hover:ring-white/50"
                }`}
              >
                {node.thumbnailUrl ? (
                  <img
                    src={node.thumbnailUrl}
                    alt={node.name}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full bg-white/10 flex items-center justify-center">
                    <span className="text-[10px] text-white/40">{idx + 1}</span>
                  </div>
                )}
              </div>

              {/* Label tooltip */}
              {isHovered && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap bg-black/90 text-white text-[10px] px-2 py-1 rounded shadow-lg pointer-events-none">
                  {node.name}
                </div>
              )}

              {/* Active indicator dot */}
              {isActive && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
