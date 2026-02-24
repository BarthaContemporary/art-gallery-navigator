import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MapPin, Move, ZoomIn, ZoomOut, RotateCcw, Grid3X3 } from "lucide-react";

interface TourNode {
  id: string;
  name: string;
  node_type: string;
  floorplan_x: number | null;
  floorplan_y: number | null;
  tour_node_images: { id: string }[];
}

interface FloorplanSketchToolProps {
  projectId: string;
  nodes: TourNode[];
}

const GRID_SIZE = 20; // number of cells
const CELL_PX = 32; // pixels per cell on base zoom

export function FloorplanSketchTool({ projectId, nodes }: FloorplanSketchToolProps) {
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [placingNodeId, setPlacingNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  // Nodes that have been placed on the grid
  const placedNodes = nodes.filter((n) => n.floorplan_x !== null && n.floorplan_y !== null);
  const unplacedNodes = nodes.filter((n) => n.floorplan_x === null || n.floorplan_y === null);

  const updateNodePosition = useMutation({
    mutationFn: async ({ nodeId, x, y }: { nodeId: string; x: number; y: number }) => {
      const { error } = await supabase
        .from("tour_nodes")
        .update({ floorplan_x: x, floorplan_y: y })
        .eq("id", nodeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-nodes", projectId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const clearNodePosition = useMutation({
    mutationFn: async (nodeId: string) => {
      const { error } = await supabase
        .from("tour_nodes")
        .update({ floorplan_x: null, floorplan_y: null })
        .eq("id", nodeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-nodes", projectId] });
      setSelectedNodeId(null);
      toast.success("Position cleared");
    },
  });

  const handleGridTap = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (!placingNodeId || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      let clientX: number, clientY: number;

      if ("touches" in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const cellSize = CELL_PX * zoom;
      const x = Math.floor((clientX - rect.left) / cellSize);
      const y = Math.floor((clientY - rect.top) / cellSize);

      if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
        updateNodePosition.mutate({ nodeId: placingNodeId, x, y });
        setPlacingNodeId(null);
        try { navigator.vibrate?.(30); } catch {}
      }
    },
    [placingNodeId, zoom, updateNodePosition]
  );

  const gridWidth = GRID_SIZE * CELL_PX * zoom;
  const gridHeight = GRID_SIZE * CELL_PX * zoom;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setZoom((z) => Math.min(z + 0.25, 2))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Badge variant="secondary" className="text-xs tabular-nums">
            {Math.round(zoom * 100)}%
          </Badge>
        </div>

        {placingNodeId && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-primary font-medium animate-pulse">
              Tap grid to place position
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPlacingNodeId(null)}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Grid canvas */}
      <div className="overflow-auto rounded-xl border border-border bg-secondary/30 touch-pan-x touch-pan-y">
        <div
          ref={canvasRef}
          className="relative cursor-crosshair select-none"
          style={{ width: gridWidth, height: gridHeight, minWidth: gridWidth }}
          onClick={handleGridTap}
          onTouchStart={handleGridTap}
        >
          {/* Grid lines */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={gridWidth}
            height={gridHeight}
          >
            {Array.from({ length: GRID_SIZE + 1 }).map((_, i) => {
              const pos = i * CELL_PX * zoom;
              return (
                <g key={i}>
                  <line
                    x1={pos} y1={0} x2={pos} y2={gridHeight}
                    stroke="hsl(var(--border))"
                    strokeWidth={i % 5 === 0 ? 1 : 0.5}
                    opacity={i % 5 === 0 ? 0.6 : 0.3}
                  />
                  <line
                    x1={0} y1={pos} x2={gridWidth} y2={pos}
                    stroke="hsl(var(--border))"
                    strokeWidth={i % 5 === 0 ? 1 : 0.5}
                    opacity={i % 5 === 0 ? 0.6 : 0.3}
                  />
                </g>
              );
            })}
          </svg>

          {/* Placed node markers */}
          {placedNodes.map((node) => {
            const cellSize = CELL_PX * zoom;
            const px = (node.floorplan_x! + 0.5) * cellSize;
            const py = (node.floorplan_y! + 0.5) * cellSize;
            const isSelected = selectedNodeId === node.id;

            return (
              <button
                key={node.id}
                className={`absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 z-10 group transition-transform ${
                  isSelected ? "scale-125" : "hover:scale-110"
                }`}
                style={{ left: px, top: py }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(isSelected ? null : node.id);
                }}
              >
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center shadow-md transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2"
                      : "bg-primary/80 text-primary-foreground"
                  }`}
                >
                  <MapPin className="h-4 w-4" />
                </div>
                <span
                  className={`text-[10px] font-medium mt-1 px-1.5 py-0.5 rounded whitespace-nowrap ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-background/90 text-foreground"
                  }`}
                >
                  {node.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected node actions */}
      {selectedNodeId && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/50 border border-border">
          <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-sm font-medium flex-1 truncate">
            {nodes.find((n) => n.id === selectedNodeId)?.name}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPlacingNodeId(selectedNodeId);
              setSelectedNodeId(null);
            }}
          >
            <Move className="h-3.5 w-3.5 mr-1.5" />
            Move
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearNodePosition.mutate(selectedNodeId)}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Clear
          </Button>
        </div>
      )}

      {/* Unplaced nodes list */}
      {unplacedNodes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Unplaced Positions ({unplacedNodes.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {unplacedNodes.map((node) => (
              <Button
                key={node.id}
                variant={placingNodeId === node.id ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setPlacingNodeId(placingNodeId === node.id ? null : node.id)
                }
                className="h-9"
              >
                <MapPin className="h-3.5 w-3.5 mr-1.5" />
                {node.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {nodes.length === 0 && (
        <div className="text-center py-8">
          <Grid3X3 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Add scan positions first, then place them on the grid
          </p>
        </div>
      )}
    </div>
  );
}
