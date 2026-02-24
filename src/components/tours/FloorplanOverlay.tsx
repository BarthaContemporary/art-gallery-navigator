import type { RoomScanResult, RoomPlanPoint } from "@/plugins/roomplan/definitions";

interface FloorplanOverlayProps {
  scanData: RoomScanResult;
  gridSize: number;
  cellPx: number;
  zoom: number;
}

/**
 * Renders the LiDAR room scan data as an SVG overlay on the floorplan grid.
 * Projects real-world metres onto grid coordinates.
 */
export function FloorplanOverlay({ scanData, gridSize, cellPx, zoom }: FloorplanOverlayProps) {
  const totalPx = gridSize * cellPx * zoom;

  // Calculate bounds from all wall points
  const allPoints = scanData.outline;
  if (allPoints.length === 0) return null;

  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const realWidth = maxX - minX || 1;
  const realHeight = maxY - minY || 1;

  // Scale and center to fit the grid with padding
  const padding = 2; // cells of padding
  const availCells = gridSize - padding * 2;
  const scaleX = (availCells * cellPx * zoom) / realWidth;
  const scaleY = (availCells * cellPx * zoom) / realHeight;
  const scale = Math.min(scaleX, scaleY);

  const offsetX = padding * cellPx * zoom + ((availCells * cellPx * zoom - realWidth * scale) / 2);
  const offsetY = padding * cellPx * zoom + ((availCells * cellPx * zoom - realHeight * scale) / 2);

  const toScreen = (p: RoomPlanPoint) => ({
    x: (p.x - minX) * scale + offsetX,
    y: (p.y - minY) * scale + offsetY,
  });

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={totalPx}
      height={totalPx}
    >
      {/* Walls */}
      {scanData.walls.map((wall, i) => {
        const s = toScreen(wall.start);
        const e = toScreen(wall.end);
        return (
          <line
            key={`wall-${i}`}
            x1={s.x} y1={s.y}
            x2={e.x} y2={e.y}
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.7}
          />
        );
      })}

      {/* Openings (doors/windows) */}
      {scanData.openings.map((opening, i) => {
        const s = toScreen(opening.start);
        const e = toScreen(opening.end);
        const isDoor = opening.type === "door";
        return (
          <line
            key={`opening-${i}`}
            x1={s.x} y1={s.y}
            x2={e.x} y2={e.y}
            stroke={isDoor ? "hsl(var(--accent))" : "hsl(var(--muted-foreground))"}
            strokeWidth={2}
            strokeDasharray={isDoor ? "6 4" : "3 3"}
            strokeLinecap="round"
            opacity={0.6}
          />
        );
      })}

      {/* Objects */}
      {scanData.objects.map((obj, i) => {
        const c = toScreen(obj.center);
        const w = obj.width * scale;
        const d = obj.depth * scale;
        return (
          <rect
            key={`obj-${i}`}
            x={c.x - w / 2}
            y={c.y - d / 2}
            width={w}
            height={d}
            fill="hsl(var(--muted))"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1}
            opacity={0.4}
            rx={2}
          />
        );
      })}

      {/* Room outline (filled) */}
      {allPoints.length > 2 && (
        <polygon
          points={allPoints.map((p) => { const s = toScreen(p); return `${s.x},${s.y}`; }).join(" ")}
          fill="hsl(var(--primary) / 0.05)"
          stroke="hsl(var(--primary))"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          opacity={0.3}
        />
      )}
    </svg>
  );
}
