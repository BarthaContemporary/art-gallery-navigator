import { useState, useMemo } from "react";
import { Map, X } from "lucide-react";

interface MinimapNode {
  id: string;
  name: string;
  floorplan_x: number | null;
  floorplan_y: number | null;
}

interface TourFloorplanMinimapProps {
  nodes: MinimapNode[];
  currentIndex: number;
  onNodeSelect: (index: number) => void;
  floorplanImageUrl?: string | null;
  className?: string;
}

/**
 * Interactive minimap showing node positions on a floorplan.
 * Bottom-left overlay, collapsible. Only renders if ≥2 nodes have coordinates.
 */
export function TourFloorplanMinimap({
  nodes,
  currentIndex,
  onNodeSelect,
  floorplanImageUrl,
  className = "",
}: TourFloorplanMinimapProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Only show if at least 2 nodes have coordinates
  const nodesWithCoords = useMemo(
    () => nodes.filter((n) => n.floorplan_x !== null && n.floorplan_y !== null),
    [nodes]
  );

  // Calculate bounds for positioning dots
  const bounds = useMemo(() => {
    if (nodesWithCoords.length < 2) return null;
    const xs = nodesWithCoords.map((n) => n.floorplan_x!);
    const ys = nodesWithCoords.map((n) => n.floorplan_y!);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    return { minX, maxX, minY, maxY, rangeX, rangeY };
  }, [nodesWithCoords]);

  const mapSize = 160;
  const padding = 20;

  if (nodesWithCoords.length < 2 || !bounds) return null;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className={`absolute bottom-20 left-4 z-30 w-10 h-10 bg-black/60 backdrop-blur-md rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-all ${className}`}
      >
        <Map className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div
      className={`absolute bottom-20 left-4 z-30 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 overflow-hidden ${className}`}
      style={{ width: mapSize, height: mapSize }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 bg-black/40">
        <span className="text-[9px] text-white/50 uppercase tracking-wider font-medium">Floorplan</span>
        <button
          onClick={() => setCollapsed(true)}
          className="text-white/40 hover:text-white/70 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Map area */}
      <div
        className="relative"
        style={{ width: mapSize, height: mapSize - 24 }}
      >
        {/* Background floorplan image */}
        {floorplanImageUrl && (
          <img
            src={floorplanImageUrl}
            alt="Floorplan"
            className="absolute inset-0 w-full h-full object-contain opacity-30"
            draggable={false}
          />
        )}

        {/* Node dots */}
        {nodes.map((node, idx) => {
          if (node.floorplan_x === null || node.floorplan_y === null) return null;

          const x = padding + ((node.floorplan_x - bounds.minX) / bounds.rangeX) * (mapSize - padding * 2);
          const y = padding + ((node.floorplan_y - bounds.minY) / bounds.rangeY) * (mapSize - 24 - padding * 2);
          const isActive = idx === currentIndex;
          const isHovered = idx === hoveredIdx;

          return (
            <button
              key={node.id}
              onClick={() => onNodeSelect(idx)}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: x, top: y }}
            >
              <div
                className={`rounded-full transition-all duration-200 ${
                  isActive
                    ? "w-4 h-4 bg-blue-500 border-2 border-white shadow-lg shadow-blue-500/50 animate-pulse"
                    : "w-2.5 h-2.5 bg-white/70 border border-white/30 hover:bg-white hover:scale-150"
                }`}
              />
              {isHovered && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap bg-black/90 text-white text-[9px] px-1.5 py-0.5 rounded pointer-events-none">
                  {node.name}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
