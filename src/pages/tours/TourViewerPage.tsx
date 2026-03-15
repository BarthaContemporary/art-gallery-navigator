import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Maximize,
  GalleryHorizontal,
  Image,
  Loader2,
  Wand2,
} from "lucide-react";
import { SphericalPanoramaViewer } from "@/components/tours/SphericalPanoramaViewer";
import { PanoramaComposer } from "@/components/tours/PanoramaComposer";
import { TourNodeStrip } from "@/components/tours/TourNodeStrip";
import { TourFloorplanMinimap } from "@/components/tours/TourFloorplanMinimap";
import { toast } from "sonner";
import { stitchPanoramaLocally } from "@/lib/tours/panorama-stitcher";

// Types
interface TourProject {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
}

interface TourNode {
  id: string;
  name: string;
  node_type: "panorama" | "image_set";
  position_index: number;
  panorama_url: string | null;
  initial_heading: number | null;
  floorplan_x: number | null;
  floorplan_y: number | null;
  stitched_panorama_url: string | null;
  stitch_status: string | null;
  panorama_strip_url: string | null;
}

interface NodeImage {
  id: string;
  original_url: string;
  thumbnail_url: string | null;
  medium_url: string | null;
  large_url: string | null;
  is_primary: boolean;
  display_order: number;
  original_width: number | null;
  original_height: number | null;
}

interface Hotspot {
  id: string;
  source_node_id: string;
  target_node_id: string;
  coord_x: number;
  coord_y: number;
  yaw: number;
  pitch: number;
  label: string | null;
}

type ViewMode = "photos" | "composer" | "360";

export default function TourViewerPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [currentNodeIdx, setCurrentNodeIdx] = useState(0);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("photos");
  const [transitioning, setTransitioning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────

  const { data: project, isLoading: projectLoading, error: projectError } = useQuery({
    queryKey: ["tour-viewer-project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tour_projects")
        .select("*")
        .eq("id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return data as TourProject | null;
    },
    enabled: !!projectId,
    retry: 2,
  });

  const { data: nodes = [], isLoading: nodesLoading, error: nodesError } = useQuery({
    queryKey: ["tour-viewer-nodes", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tour_nodes")
        .select("*")
        .eq("project_id", projectId!)
        .order("position_index", { ascending: true });
      if (error) throw error;
      return data as TourNode[];
    },
    enabled: !!projectId,
  });

  const currentNode = nodes[currentNodeIdx] || null;

  const { data: nodeImages = [], isLoading: nodeImagesLoading, error: nodeImagesError } = useQuery({
    queryKey: ["tour-viewer-images", currentNode?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tour_node_images")
        .select("*")
        .eq("node_id", currentNode!.id)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as NodeImage[];
    },
    enabled: !!currentNode?.id,
  });

  const { data: hotspots = [] } = useQuery({
    queryKey: ["tour-viewer-hotspots", currentNode?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tour_hotspots")
        .select("*")
        .eq("source_node_id", currentNode!.id);
      if (error) throw error;
      return data as Hotspot[];
    },
    enabled: !!currentNode?.id,
  });

  // ── AI panorama stitching ─────────────────────────────────────

  const [stitchProgress, setStitchProgress] = useState<number | null>(null);

  const stitchMutation = useMutation({
    mutationFn: async (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node?.panorama_strip_url) throw new Error("No panorama strip saved");

      // Mark as processing
      await supabase
        .from("tour_nodes")
        .update({ stitch_status: "processing" })
        .eq("id", nodeId);
      queryClient.invalidateQueries({ queryKey: ["tour-viewer-nodes", projectId] });

      // Run client-side geometric projection
      const blob = await stitchPanoramaLocally(node.panorama_strip_url, (pct) =>
        setStitchProgress(pct)
      );

      // Upload to Supabase Storage
      const storagePath = `projects/${projectId}/nodes/${nodeId}/equirectangular_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("tour-uploads")
        .upload(storagePath, blob, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("tour-uploads")
        .getPublicUrl(storagePath);

      // Update node with the result
      const { error: updateError } = await supabase
        .from("tour_nodes")
        .update({
          stitched_panorama_url: `${urlData.publicUrl}?t=${Date.now()}`,
          stitch_status: "completed",
        })
        .eq("id", nodeId);
      if (updateError) throw updateError;

      return { url: urlData.publicUrl };
    },
    onSuccess: () => {
      setStitchProgress(null);
      queryClient.invalidateQueries({ queryKey: ["tour-viewer-nodes", projectId] });
    },
    onError: async (err) => {
      setStitchProgress(null);
      // Reset status on failure
      if (currentNode) {
        await supabase
          .from("tour_nodes")
          .update({ stitch_status: "failed" })
          .eq("id", currentNode.id);
        queryClient.invalidateQueries({ queryKey: ["tour-viewer-nodes", projectId] });
      }
      toast.error("360° generation failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    },
  });

  const isStitching =
    (currentNode?.stitch_status === "processing" && !!currentNode?.panorama_strip_url) ||
    stitchMutation.isPending;

  // No polling needed — processing is now client-side and synchronous within the mutation

  // Auto-switch to 360° when stitch completes
  useEffect(() => {
    if (currentNode?.stitch_status === "completed" && currentNode?.stitched_panorama_url) {
      toast.success("360° panorama ready!");
      setViewMode("360");
    }
  }, [currentNode?.stitch_status, currentNode?.stitched_panorama_url]);

  // Auto-select view mode on node change
  useEffect(() => {
    if (currentNode?.stitched_panorama_url && currentNode?.stitch_status === "completed") {
      setViewMode("360");
    } else {
      setViewMode("photos");
    }
    setCurrentImageIdx(0);
  }, [currentNode?.id]);

  // ── Navigation ────────────────────────────────────────────────

  const goToNode = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= nodes.length || idx === currentNodeIdx) return;
      setTransitioning(true);
      setTimeout(() => {
        setCurrentNodeIdx(idx);
        setTimeout(() => setTransitioning(false), 50);
      }, 300);
    },
    [nodes.length, currentNodeIdx]
  );

  const goToNodeById = useCallback(
    (nodeId: string) => {
      const idx = nodes.findIndex((n) => n.id === nodeId);
      if (idx >= 0) goToNode(idx);
    },
    [nodes, goToNode]
  );

  // Keyboard nav
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        if (viewMode === "photos" && currentImageIdx < nodeImages.length - 1) {
          setCurrentImageIdx((i) => i + 1);
        }
      }
      if (e.key === "ArrowLeft") {
        if (viewMode === "photos" && currentImageIdx > 0) {
          setCurrentImageIdx((i) => i - 1);
        }
      }
      if (e.key === "ArrowDown") goToNode(currentNodeIdx + 1);
      if (e.key === "ArrowUp") goToNode(currentNodeIdx - 1);
      if (e.key === "Escape") navigate(-1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentImageIdx, nodeImages.length, currentNodeIdx, nodes.length, viewMode, goToNode, navigate]);

  // Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // ── Derived state ─────────────────────────────────────────────

  const currentImage = nodeImages[currentImageIdx] || null;
  const currentImageUrl = currentImage?.original_url || "";
  const hasStitchedPanorama = !!currentNode?.stitched_panorama_url && currentNode?.stitch_status === "completed";
  const hasPanoramaStrip = !!currentNode?.panorama_strip_url;
  const isPanorama = currentNode?.node_type === "panorama";
  const showComposer = viewMode === "composer" && !isPanorama && nodeImages.length >= 2;
  const show360 = viewMode === "360" && hasStitchedPanorama;

  // Node strip data
  const stripNodes = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        name: n.name,
        thumbnailUrl: null as string | null,
      })),
    [nodes]
  );

  // Fetch first image thumbnails for the strip
  const { data: allFirstImages = {} } = useQuery({
    queryKey: ["tour-viewer-strip-thumbs", projectId],
    queryFn: async () => {
      const nodeIds = nodes.map((n) => n.id);
      if (nodeIds.length === 0) return {};
      const { data, error } = await supabase
        .from("tour_node_images")
        .select("node_id, original_url, thumbnail_url")
        .in("node_id", nodeIds)
        .order("display_order", { ascending: true });
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((img: any) => {
        if (!map[img.node_id]) {
          map[img.node_id] = img.thumbnail_url || img.original_url;
        }
      });
      return map;
    },
    enabled: nodes.length > 0,
  });

  const enrichedStripNodes = useMemo(
    () =>
      stripNodes.map((n) => ({
        ...n,
        thumbnailUrl: allFirstImages[n.id] || null,
      })),
    [stripNodes, allFirstImages]
  );

  // ── Loading / Error / Empty states ────────────────────────────

  if (projectLoading || nodesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="text-center space-y-3">
          <div className="animate-spin h-6 w-6 border-2 border-white/30 border-t-white rounded-full mx-auto" />
          <p className="text-sm text-white/40">Loading tour…</p>
        </div>
      </div>
    );
  }

  if (projectError || nodesError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="text-center space-y-4">
          <p className="text-base font-medium">Unable to load tour</p>
          <p className="text-sm text-white/40 max-w-sm">
            {projectError ? "This tour may not exist or you don't have permission." : "Failed to load tour data."}
          </p>
          <button
            className="px-4 py-2 text-sm text-white/70 hover:text-white border border-white/15 hover:border-white/30 rounded-lg transition-colors"
            onClick={() => navigate(-1)}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="text-center space-y-4">
          <p className="text-base font-medium">Tour not found</p>
          <button
            className="px-4 py-2 text-sm text-white/70 hover:text-white border border-white/15 hover:border-white/30 rounded-lg transition-colors"
            onClick={() => navigate(-1)}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="text-center space-y-4">
          <p className="text-base font-medium">{project.title}</p>
          <p className="text-sm text-white/40">No scan positions yet.</p>
          <button
            className="px-4 py-2 text-sm text-white/70 hover:text-white border border-white/15 hover:border-white/30 rounded-lg transition-colors"
            onClick={() => navigate(-1)}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col overflow-hidden z-[100]">
      {/* Fade transition overlay */}
      <div
        className="absolute inset-0 z-[200] bg-black pointer-events-none transition-opacity duration-300"
        style={{ opacity: transitioning ? 1 : 0 }}
      />

      {/* Top bar — hidden in composer mode (composer has its own toolbar), auto-hide in 360 */}
      {viewMode !== "composer" && (
        <div
          className={`absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/60 to-transparent pointer-events-none transition-opacity duration-300 ${
            show360 ? "opacity-0 hover:opacity-100" : ""
          }`}
          onPointerEnter={(e) => {
            if (show360) (e.currentTarget as HTMLElement).style.opacity = "1";
          }}
          onPointerLeave={(e) => {
            if (show360) (e.currentTarget as HTMLElement).style.opacity = "0";
          }}
        >
          <div className="flex items-center justify-between px-4 py-3">
            {/* Left: title */}
            <div className="pointer-events-auto min-w-0 flex-1">
              <h1 className="text-[13px] font-medium text-white/90 truncate">{project.title}</h1>
              <p className="text-[11px] text-white/40 truncate">{currentNode?.name}</p>
            </div>

            {/* Center: view mode pills */}
            {!isPanorama && (
              <div className="pointer-events-auto flex items-center gap-0.5 bg-white/8 backdrop-blur-md rounded-lg p-0.5 mx-4">
                <button
                  onClick={() => setViewMode("photos")}
                  className={`flex items-center gap-1 px-3 py-1.5 text-[11px] rounded-md transition-all ${
                    viewMode === "photos"
                      ? "bg-white/15 text-white font-medium"
                      : "text-white/45 hover:text-white/70"
                  }`}
                >
                  <Image className="h-3 w-3" />
                  Photos
                </button>
                {nodeImages.length >= 2 && (
                  <button
                    onClick={() => setViewMode("composer")}
                    className="flex items-center gap-1 px-3 py-1.5 text-[11px] rounded-md transition-all text-white/45 hover:text-white/70"
                  >
                    <GalleryHorizontal className="h-3 w-3" />
                    Compose
                  </button>
                )}
                {hasStitchedPanorama && (
                  <button
                    onClick={() => setViewMode("360")}
                    className={`px-3 py-1.5 text-[11px] rounded-md transition-all ${
                      viewMode === "360"
                        ? "bg-white/15 text-white font-medium"
                        : "text-white/45 hover:text-white/70"
                    }`}
                  >
                    360°
                  </button>
                )}
              </div>
            )}

            {/* Right: AI stitch + fullscreen + close */}
            <div className="pointer-events-auto flex items-center gap-1 ml-3 shrink-0">
              {!isPanorama && hasPanoramaStrip && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className={`h-8 w-8 flex items-center justify-center rounded-full transition-all ${
                          currentNode?.stitch_status === "completed"
                            ? "text-emerald-400/80 hover:text-emerald-300"
                            : currentNode?.stitch_status === "failed"
                              ? "text-red-400/80 hover:text-red-300"
                              : "text-white/40 hover:text-white/70"
                        } hover:bg-white/10`}
                        onClick={() => {
                          if (currentNode && !isStitching) {
                            stitchMutation.mutate(currentNode.id);
                          }
                        }}
                        disabled={isStitching}
                      >
                        {isStitching ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Wand2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-black/90 text-white border-white/10">
                      <p className="text-xs">
                        {stitchMutation.isPending
                          ? `Generating 360°… ${stitchProgress != null ? `${Math.round(stitchProgress)}%` : ""}`
                          : currentNode?.stitch_status === "failed"
                            ? "Retry 360° generation"
                            : "Generate 360°"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <button
                className="h-8 w-8 flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/10 rounded-full transition-all"
                onClick={toggleFullscreen}
              >
                <Maximize className="h-3.5 w-3.5" />
              </button>
              <button
                className="h-8 w-8 flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/10 rounded-full transition-all"
                onClick={() => navigate(-1)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main viewer area */}
      <div className="flex-1 relative">
        {nodeImagesLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <Loader2 className="h-6 w-6 animate-spin text-white/30" />
          </div>
        ) : nodeImagesError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <p className="text-sm text-white/40">Could not load images.</p>
          </div>
        ) : nodeImages.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <p className="text-sm text-white/40">No images for this node.</p>
          </div>
        ) : showComposer ? (
          <PanoramaComposer
            nodeId={currentNode!.id}
            images={nodeImages}
            className="absolute inset-0"
            canProcess={!isStitching}
            processing={stitchMutation.isPending || isStitching}
            onProcess={() => {
              if (!currentNode || isStitching) return;
              if (!hasPanoramaStrip) {
                toast.error("Save the panorama strip first");
                return;
              }
              stitchMutation.mutate(currentNode.id);
            }}
            onExit={() => setViewMode("photos")}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ["tour-viewer-nodes", projectId] });
            }}
          />
        ) : show360 ? (
          <SphericalPanoramaViewer
            stitchedPanoramaUrl={currentNode!.stitched_panorama_url!}
            className="absolute inset-0"
            hotspots={hotspots}
            onHotspotClick={goToNodeById}
            initialHeading={currentNode?.initial_heading}
          />
        ) : (
          /* Photos mode — clean full-bleed image */
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            {currentImageUrl ? (
              <img
                src={currentImageUrl}
                alt={currentNode?.name || "Tour photo"}
                className="max-h-full max-w-full object-contain select-none"
                draggable={false}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <p className="text-sm text-white/40">No image available</p>
            )}

            {/* Image nav arrows (multi-image nodes) */}
            {nodeImages.length > 1 && (
              <>
                <button
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-full text-white/50 hover:text-white hover:bg-black/50 transition-all disabled:opacity-20"
                  onClick={() => setCurrentImageIdx((i) => Math.max(0, i - 1))}
                  disabled={currentImageIdx === 0}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-full text-white/50 hover:text-white hover:bg-black/50 transition-all disabled:opacity-20"
                  onClick={() => setCurrentImageIdx((i) => Math.min(nodeImages.length - 1, i + 1))}
                  disabled={currentImageIdx === nodeImages.length - 1}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-sm text-white/50 text-[10px] px-3 py-1 rounded-full tabular-nums">
                  {currentImageIdx + 1} / {nodeImages.length}
                </div>
              </>
            )}

            {/* 2D Hotspot overlays in photos mode */}
            {hotspots.length > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                {hotspots.map((hs) => (
                  <button
                    key={hs.id}
                    className="absolute pointer-events-auto w-10 h-10 -ml-5 -mt-5 group"
                    style={{ left: `${hs.coord_x * 100}%`, top: `${hs.coord_y * 100}%` }}
                    onClick={() => goToNodeById(hs.target_node_id)}
                  >
                    <div className="w-7 h-7 mx-auto rounded-full bg-white/15 backdrop-blur-sm border border-white/40 flex items-center justify-center group-hover:bg-white/30 group-hover:scale-110 transition-all">
                      <ChevronRight className="h-3.5 w-3.5 text-white/80" />
                    </div>
                    {hs.label && (
                      <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap text-[9px] bg-black/70 text-white/80 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        {hs.label}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom overlays — Node strip & Minimap */}
      {viewMode !== "composer" && viewMode !== "360" && (
        <>
          <TourNodeStrip
            nodes={enrichedStripNodes}
            currentIndex={currentNodeIdx}
            onNodeSelect={goToNode}
          />
          <TourFloorplanMinimap
            nodes={nodes}
            currentIndex={currentNodeIdx}
            onNodeSelect={goToNode}
          />
        </>
      )}
    </div>
  );
}
