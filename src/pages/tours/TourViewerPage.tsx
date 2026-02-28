import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  ChevronLeft,
  ChevronRight,
  List,
  X,
  ZoomIn,
  ZoomOut,
  Maximize,
  MapPin,
  Eye,
  Crosshair,
  Info,
  Ruler,
  Layers,
  Lock,
  GalleryHorizontal,
  Image,
  Box,
  Loader2,
  Wand2,
} from "lucide-react";
import OpenSeadragon from "openseadragon";
import { ImmersiveStripViewer } from "@/components/tours/ImmersiveStripViewer";
import { Tour3DViewer } from "@/components/tours/Tour3DViewer";
import { SphericalPanoramaViewer } from "@/components/tours/SphericalPanoramaViewer";
import { toast } from "sonner";

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

interface Annotation {
  id: string;
  node_image_id: string;
  x: number;
  y: number;
  label: string;
  annotation_type: string;
  content: Record<string, any>;
  visible_to: string;
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

type ViewMode = "single" | "immersive" | "3d" | "spherical";

const getImageUrlCandidates = (img?: NodeImage | null) => {
  if (!img) return [] as string[];
  return [img.large_url, img.medium_url, img.thumbnail_url, img.original_url]
    .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
    .filter((u, i, arr) => arr.indexOf(u) === i);
};

export default function TourViewerPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const viewerRef = useRef<HTMLDivElement>(null);
  const osdRef = useRef<OpenSeadragon.Viewer | null>(null);

  const [currentNodeIdx, setCurrentNodeIdx] = useState(0);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectionMode, setInspectionMode] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [osdFailed, setOsdFailed] = useState(false);
  const [reconstructionStarted, setReconstructionStarted] = useState(false);

  // Fetch project
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

  // Fetch nodes
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

  const {
    data: nodeImages = [],
    isLoading: nodeImagesLoading,
    error: nodeImagesError,
  } = useQuery({
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

  // Fetch 3D reconstruction for current node (polls while processing)
  const { data: reconstruction } = useQuery({
    queryKey: ["tour-3d-reconstruction", currentNode?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tour_3d_reconstructions")
        .select("*")
        .eq("node_id", currentNode!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentNode?.id,
    refetchInterval: (query) => {
      // Poll every 3s while processing
      const data = query.state.data;
      if (data?.status === "processing") return 3000;
      return false;
    },
  });

  // Switch to 3D view when reconstruction completes
  useEffect(() => {
    if (reconstruction?.status === "completed" && reconstruction.camera_poses && viewMode !== "3d") {
      // Only auto-switch if we were waiting for it (mutation was pending)
      if (reconstructionStarted) {
        setViewMode("3d");
        toast.success("3D reconstruction complete");
        setReconstructionStarted(false);
      }
    } else if (reconstruction?.status === "failed" && reconstructionStarted) {
      toast.error("3D reconstruction failed", { description: reconstruction.error_message || "Unknown error" });
      setReconstructionStarted(false);
    }
  }, [reconstruction?.status]);

  // 3D reconstruction mutation (now returns immediately)
  const reconstructMutation = useMutation({
    mutationFn: async (nodeId: string) => {
      const { data, error } = await supabase.functions.invoke("analyze-tour-photogrammetry", {
        body: { node_id: nodeId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      setReconstructionStarted(true);
      queryClient.invalidateQueries({ queryKey: ["tour-3d-reconstruction", currentNode?.id] });
      toast.info("3D reconstruction started...", { description: "This may take 15-30 seconds" });
    },
    onError: (err) => {
      toast.error("3D reconstruction failed", { description: err instanceof Error ? err.message : "Unknown error" });
    },
  });

  // AI panorama stitching mutation
  const stitchMutation = useMutation({
    mutationFn: async (nodeId: string) => {
      const { data, error } = await supabase.functions.invoke("stitch-panorama", {
        body: { node_id: nodeId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.info("AI panorama stitching started...", { description: "This may take 30-60 seconds" });
      queryClient.invalidateQueries({ queryKey: ["tour-viewer-nodes", projectId] });
    },
    onError: (err) => {
      toast.error("Panorama stitching failed", { description: err instanceof Error ? err.message : "Unknown error" });
    },
  });

  // Poll nodes while stitching is in progress
  const isStitching = currentNode?.stitch_status === "processing";
  useEffect(() => {
    if (!isStitching) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["tour-viewer-nodes", projectId] });
    }, 4000);
    return () => clearInterval(interval);
  }, [isStitching, queryClient, projectId]);

  // Notify on stitch completion
  useEffect(() => {
    if (currentNode?.stitch_status === "completed" && currentNode?.stitched_panorama_url) {
      toast.success("AI panorama ready!");
    }
  }, [currentNode?.stitch_status]);

  // Auto-select best view mode when node changes
  useEffect(() => {
    if (reconstruction?.status === "completed" && reconstruction.camera_poses) {
      setViewMode("3d");
    } else if (nodeImages.length >= 3) {
      setViewMode("spherical");
    } else {
      setViewMode("single");
    }
  }, [currentNode?.id, nodeImages.length, reconstruction?.status]);

  // Fetch hotspots for current node
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

  // Current image + robust URL fallback list
  const currentImage = nodeImages[currentImageIdx] || null;
  const currentImageCandidates = useMemo(() => getImageUrlCandidates(currentImage), [currentImage]);
  const [currentImageUrlIndex, setCurrentImageUrlIndex] = useState(0);

  useEffect(() => {
    setCurrentImageUrlIndex(0);
  }, [currentImage?.id]);

  const currentImageUrl = currentImageCandidates[currentImageUrlIndex] || "";

  const handleCurrentImageFallback = useCallback(() => {
    setCurrentImageUrlIndex((prev) => {
      const next = prev + 1;
      return next < currentImageCandidates.length ? next : prev;
    });
  }, [currentImageCandidates.length]);

  const { data: annotations = [] } = useQuery({
    queryKey: ["tour-viewer-annotations", currentImage?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tour_annotations")
        .select("*")
        .eq("node_image_id", currentImage!.id);
      if (error) throw error;
      return data as Annotation[];
    },
    enabled: !!currentImage?.id,
  });

  // Filter annotations by visibility
  const visibleAnnotations = useMemo(() => {
    if (!showAnnotations) return [];
    return annotations.filter((a) => {
      if (a.visible_to === "public") return true;
      if (a.visible_to === "authenticated" && user) return true;
      return false;
    });
  }, [annotations, showAnnotations, user]);

  // Reset image index when node changes
  useEffect(() => {
    setCurrentImageIdx(0);
    setOsdFailed(false);
  }, [currentNodeIdx]);

  // Initialize/update OpenSeadragon for image-set nodes (single mode only)
  useEffect(() => {
    if (viewMode !== "single") return;
    if (!viewerRef.current) return;
    if (!currentNode || currentNode.node_type !== "image_set") return;
    if (!currentImageUrl) {
      setOsdFailed(true);
      return;
    }

    setOsdFailed(false);

    // Destroy previous viewer
    if (osdRef.current) {
      osdRef.current.destroy();
      osdRef.current = null;
    }

    try {
      const viewer = OpenSeadragon({
        element: viewerRef.current,
        tileSources: {
          type: "image",
          url: currentImageUrl,
        },
        prefixUrl: "",
        showNavigationControl: false,
        showNavigator: inspectionMode,
        navigatorPosition: "BOTTOM_RIGHT",
        navigatorSizeRatio: 0.15,
        minZoomLevel: 0.5,
        maxZoomLevel: inspectionMode ? 10 : 4,
        visibilityRatio: 0.5,
        constrainDuringPan: true,
        animationTime: 0.3,
        gestureSettingsMouse: { clickToZoom: false, dblClickToZoom: true },
        gestureSettingsTouch: { pinchToZoom: true, dblClickToZoom: true },
        zoomPerScroll: 1.2,
      });

      // Handle open failure - try next URL candidate, then plain img fallback
      viewer.addHandler("open-failed", () => {
        viewer.destroy();
        osdRef.current = null;
        if (currentImageUrlIndex < currentImageCandidates.length - 1) {
          handleCurrentImageFallback();
        } else {
          setOsdFailed(true);
        }
      });

      osdRef.current = viewer;

      return () => {
        viewer.destroy();
        osdRef.current = null;
      };
    } catch {
      if (currentImageUrlIndex < currentImageCandidates.length - 1) {
        handleCurrentImageFallback();
      } else {
        setOsdFailed(true);
      }
    }
  }, [
    currentImage?.id,
    currentImageUrl,
    currentImageUrlIndex,
    currentImageCandidates.length,
    currentNode?.node_type,
    handleCurrentImageFallback,
    inspectionMode,
    viewMode,
  ]);

  // Panorama check
  const isPanorama = currentNode?.node_type === "panorama";

  // Navigation
  const goToNode = useCallback((idx: number) => {
    if (idx >= 0 && idx < nodes.length) {
      setCurrentNodeIdx(idx);
    }
  }, [nodes.length]);

  const goToNodeById = useCallback((nodeId: string) => {
    const idx = nodes.findIndex((n) => n.id === nodeId);
    if (idx >= 0) goToNode(idx);
  }, [nodes, goToNode]);

  const nextNode = () => goToNode(currentNodeIdx + 1);
  const prevNode = () => goToNode(currentNodeIdx - 1);

  const nextImage = () => {
    if (currentImageIdx < nodeImages.length - 1) setCurrentImageIdx((i) => i + 1);
  };
  const prevImage = () => {
    if (currentImageIdx > 0) setCurrentImageIdx((i) => i - 1);
  };

  // Keyboard nav
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "ArrowLeft") prevImage();
      if (e.key === "ArrowDown") nextNode();
      if (e.key === "ArrowUp") prevNode();
      if (e.key === "Escape") setSidebarOpen(false);
      if (e.key === "i" || e.key === "I") setInspectionMode((v) => !v);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentImageIdx, nodeImages.length, currentNodeIdx, nodes.length]);

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

  // Annotation type icon
  const annotationIcon = (type: string) => {
    switch (type) {
      case "material": return <Layers className="h-3 w-3" />;
      case "dimension": return <Ruler className="h-3 w-3" />;
      case "price": return <span className="text-[10px] font-bold">$</span>;
      default: return <Info className="h-3 w-3" />;
    }
  };

  // Loading state
  if (projectLoading || nodesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="text-center space-y-3">
          <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-white/60">Loading tour...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (projectError || nodesError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="text-center space-y-4">
          <p className="text-lg font-medium">Unable to load tour</p>
          <p className="text-sm text-white/50 max-w-sm">
            {projectError ? "This tour may not exist or you don't have permission to view it." : "Failed to load tour data."}
          </p>
          <Button variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Not found state
  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="text-center space-y-4">
          <p className="text-lg font-medium">Tour not found</p>
          <p className="text-sm text-white/50">This tour doesn't exist or has been removed.</p>
          <Button variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Empty nodes state
  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="text-center space-y-4">
          <p className="text-lg font-medium">{project.title}</p>
          <p className="text-sm text-white/50">This tour has no scan positions yet.</p>
          <Button variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const canUseAdvancedViews = !isPanorama && nodeImages.length >= 2;
  const canUseSpherical = !isPanorama && nodeImages.length >= 3;
  const showImmersive = viewMode === "immersive" && canUseAdvancedViews;
  const showSpherical = viewMode === "spherical" && canUseSpherical;
  const show3D = viewMode === "3d" && reconstruction?.status === "completed" && reconstruction.camera_poses;

  return (
    <div className="fixed inset-0 bg-black text-white flex overflow-hidden z-[100]">
      {/* Sidebar */}
      <div
        className={`absolute md:relative z-50 h-full bg-black/95 backdrop-blur-xl border-r border-white/10 transition-all duration-300 flex flex-col ${
          sidebarOpen ? "w-72 translate-x-0" : "w-0 -translate-x-full md:w-0 md:-translate-x-full"
        }`}
      >
        {sidebarOpen && (
          <>
            <div className="p-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
              <div className="min-w-0">
                <h2 className="font-semibold truncate text-sm">{project.title}</h2>
                {project.description && (
                  <p className="text-xs text-white/50 truncate mt-0.5">{project.description}</p>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/60 hover:text-white flex-shrink-0" onClick={() => setSidebarOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {nodes.map((node, idx) => (
                <button
                  key={node.id}
                  onClick={() => { goToNode(idx); setSidebarOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    idx === currentNodeIdx
                      ? "bg-white/15 text-white"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className="font-medium">{node.name}</span>
                  <span className="block text-[10px] mt-0.5 opacity-60">
                    {node.node_type === "panorama" ? "360° Panorama" : "Image Set"}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Main viewer area */}
      <div className="flex-1 relative flex flex-col">
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between p-3 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <List className="h-4 w-4" />
            </Button>
            <div className="text-sm">
              <span className="font-medium">{currentNode?.name}</span>
              {viewMode === "single" && nodeImages.length > 1 && (
                <span className="text-white/50 ml-2 text-xs">
                  {currentImageIdx + 1} / {nodeImages.length}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 pointer-events-auto">
            {/* View mode + 3D controls for image sets */}
            {!isPanorama && (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 hover:bg-white/10 ${
                          viewMode === "immersive" ? "text-blue-400 bg-white/10" : "text-white/70 hover:text-white"
                        }`}
                        onClick={() => setViewMode(viewMode === "immersive" ? "single" : "immersive")}
                        disabled={!canUseAdvancedViews || nodeImagesLoading}
                      >
                        {viewMode === "immersive" ? <Image className="h-4 w-4" /> : <GalleryHorizontal className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">
                        {!canUseAdvancedViews ? "Need at least 2 photos" : viewMode === "immersive" ? "Single Image View" : "Immersive Strip View"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* 360° Spherical View toggle */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 hover:bg-white/10 ${
                          viewMode === "spherical" ? "text-cyan-400 bg-white/10" : "text-white/70 hover:text-white"
                        }`}
                        onClick={() => setViewMode(viewMode === "spherical" ? "single" : "spherical")}
                        disabled={!canUseSpherical || nodeImagesLoading}
                      >
                        <span className="text-sm">360°</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">
                        {!canUseSpherical ? "Need at least 3 photos" : viewMode === "spherical" ? "Exit 360° View" : "360° Spherical View"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* AI Stitch Panorama button */}
                {canUseSpherical && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 hover:bg-white/10 ${
                            currentNode?.stitch_status === "completed"
                              ? "text-emerald-400 bg-white/10"
                              : "text-white/70 hover:text-white"
                          }`}
                          onClick={() => {
                            if (currentNode && currentNode.stitch_status !== "processing") {
                              stitchMutation.mutate(currentNode.id);
                            }
                          }}
                          disabled={
                            stitchMutation.isPending ||
                            currentNode?.stitch_status === "processing" ||
                            nodeImagesLoading
                          }
                        >
                          {stitchMutation.isPending || currentNode?.stitch_status === "processing" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Wand2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="text-xs">
                          {currentNode?.stitch_status === "processing"
                            ? "AI stitching in progress…"
                            : currentNode?.stitch_status === "completed"
                              ? "AI Panorama ready (click to re-stitch)"
                              : "AI Stitch Panorama"}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {/* 3D Reconstruction toggle */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 hover:bg-white/10 ${
                          viewMode === "3d" ? "text-emerald-400 bg-white/10" : "text-white/70 hover:text-white"
                        }`}
                        onClick={() => {
                          if (viewMode === "3d") {
                            setViewMode("single");
                          } else if (reconstruction?.status === "completed" && reconstruction.camera_poses) {
                            setViewMode("3d");
                          } else if (!reconstructMutation.isPending && reconstruction?.status !== "processing") {
                            reconstructMutation.mutate(currentNode!.id);
                          }
                        }}
                        disabled={reconstructMutation.isPending || reconstruction?.status === "processing" || !canUseAdvancedViews || nodeImagesLoading}
                      >
                        {reconstructMutation.isPending || reconstruction?.status === "processing" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Box className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">
                        {!canUseAdvancedViews
                          ? "Need at least 2 photos"
                          : viewMode === "3d"
                            ? "Exit 3D View"
                            : reconstruction?.status === "completed"
                              ? "3D Model View"
                              : reconstruction?.status === "processing" || reconstructMutation.isPending
                                ? "Analyzing spatial layout..."
                                : "Build 3D Model (AI)"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}

            {/* Inspection Mode Toggle */}
            {viewMode === "single" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 hover:bg-white/10 ${
                        inspectionMode ? "text-amber-400 bg-white/10" : "text-white/70 hover:text-white"
                      }`}
                      onClick={() => setInspectionMode(!inspectionMode)}
                    >
                      <Crosshair className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">{inspectionMode ? "Exit Inspection Mode" : "Inspection Mode (I)"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Annotation toggle */}
            {inspectionMode && viewMode === "single" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 hover:bg-white/10 ${
                        showAnnotations ? "text-white" : "text-white/40"
                      }`}
                      onClick={() => setShowAnnotations(!showAnnotations)}
                    >
                      <MapPin className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">{showAnnotations ? "Hide Annotations" : "Show Annotations"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={toggleFullscreen}>
              <Maximize className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={() => navigate(-1)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Inspection Mode Banner */}
        {inspectionMode && viewMode === "single" && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 bg-amber-500/90 backdrop-blur-sm text-black px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 shadow-lg">
            <Crosshair className="h-3.5 w-3.5" />
            Inspection Mode — Full Resolution Deep Zoom
            {!user && (
              <span className="flex items-center gap-1 text-amber-900">
                <Lock className="h-3 w-3" /> Login for annotations
              </span>
            )}
          </div>
        )}

        {/* Viewer */}
        {nodeImagesLoading ? (
          <div className="flex-1 flex items-center justify-center bg-black">
            <div className="text-center space-y-3">
              <Loader2 className="h-6 w-6 animate-spin text-white/70 mx-auto" />
              <p className="text-sm text-white/60">Loading images...</p>
            </div>
          </div>
        ) : nodeImagesError ? (
          <div className="flex-1 flex items-center justify-center bg-black px-6">
            <div className="text-center space-y-3">
              <p className="text-sm text-white">Could not load this image set.</p>
              <p className="text-xs text-white/50">Please refresh or try another scan position.</p>
            </div>
          </div>
        ) : nodeImages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center bg-black px-6">
            <div className="text-center space-y-3">
              <p className="text-sm text-white">No images found for this node.</p>
              <p className="text-xs text-white/50">Upload photos to enable preview, immersive, and 3D reconstruction.</p>
            </div>
          </div>
        ) : show3D ? (
          <Tour3DViewer
            cameraPoses={reconstruction!.camera_poses as any[]}
            sceneConfig={(reconstruction!.scene_config as any) || { scene_type: "room", estimated_width_m: 10, estimated_depth_m: 10, camera_height_m: 1.6, description: "3D Reconstruction" }}
            images={nodeImages}
            className="flex-1"
          />
        ) : showSpherical ? (
          <SphericalPanoramaViewer
            images={nodeImages}
            stitchedPanoramaUrl={currentNode?.stitched_panorama_url}
            className="flex-1"
          />
        ) : showImmersive ? (
          <ImmersiveStripViewer images={nodeImages} className="flex-1" />
        ) : isPanorama ? (
          // Panorama viewer
          <div className="flex-1 relative overflow-hidden">
            {currentImageUrl && (
              <div className="absolute inset-0 flex items-center justify-center">
                <img
                  src={currentImageUrl}
                  alt={currentNode?.name}
                  className="max-w-none h-full object-cover"
                  style={{ minWidth: "200%" }}
                  draggable={false}
                  onError={handleCurrentImageFallback}
                />
              </div>
            )}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white/80 px-4 py-2 rounded-full text-xs">
              360° Panorama — Drag to look around
            </div>
          </div>
        ) : (
          // Image Set - OpenSeadragon deep zoom or fallback
          <div className="flex-1 relative">
            {osdFailed ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                {currentImageUrl ? (
                  <img
                    src={currentImageUrl}
                    alt={currentNode?.name || "Tour image"}
                    className="max-h-full max-w-full object-contain"
                    onError={handleCurrentImageFallback}
                  />
                ) : (
                  <p className="text-sm text-white/60">No valid image URL available.</p>
                )}
              </div>
            ) : (
              <div ref={viewerRef} className="absolute inset-0" />
            )}

            {/* Annotation Pins overlay */}
            {inspectionMode && visibleAnnotations.length > 0 && osdRef.current && !osdFailed && (
              <AnnotationOverlay
                viewer={osdRef.current}
                annotations={visibleAnnotations}
                annotationIcon={annotationIcon}
              />
            )}

            {/* Hotspot overlays */}
            {hotspots.length > 0 && !inspectionMode && (
              <div className="absolute inset-0 pointer-events-none">
                {hotspots.map((hs) => (
                  <button
                    key={hs.id}
                    className="absolute pointer-events-auto w-10 h-10 -ml-5 -mt-5 group"
                    style={{ left: `${hs.coord_x * 100}%`, top: `${hs.coord_y * 100}%` }}
                    onClick={() => goToNodeById(hs.target_node_id)}
                  >
                    <div className="w-8 h-8 mx-auto rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/50 flex items-center justify-center group-hover:bg-white/40 group-hover:scale-110 transition-all shadow-lg">
                      <ChevronRight className="h-4 w-4 text-white" />
                    </div>
                    {hs.label && (
                      <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap text-[10px] bg-black/70 text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        {hs.label}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 z-40 flex items-center justify-between p-3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
          {/* Image thumbnails strip (only in single mode) */}
          {viewMode === "single" && nodeImages.length > 1 && (
            <div className="flex items-center gap-2 pointer-events-auto mx-auto">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={prevImage} disabled={currentImageIdx === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex gap-1.5 max-w-xs overflow-x-auto">
                {nodeImages.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setCurrentImageIdx(idx)}
                    className={`w-12 h-12 rounded overflow-hidden flex-shrink-0 border-2 transition-all ${
                      idx === currentImageIdx ? "border-white scale-105" : "border-transparent opacity-60 hover:opacity-90"
                    }`}
                  >
                    <img
                      src={getImageUrlCandidates(img)[0] || ""}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={nextImage} disabled={currentImageIdx === nodeImages.length - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Node nav */}
          {nodes.length > 1 && (
            <div className="flex items-center gap-1 pointer-events-auto absolute bottom-3 right-3">
              <Button variant="ghost" size="sm" className="h-8 text-white/70 hover:text-white hover:bg-white/10 text-xs" onClick={prevNode} disabled={currentNodeIdx === 0}>
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
              </Button>
              <span className="text-xs text-white/50 px-1">
                {currentNodeIdx + 1}/{nodes.length}
              </span>
              <Button variant="ghost" size="sm" className="h-8 text-white/70 hover:text-white hover:bg-white/10 text-xs" onClick={nextNode} disabled={currentNodeIdx === nodes.length - 1}>
                Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Annotation overlay component that syncs with OSD viewport
function AnnotationOverlay({
  viewer,
  annotations,
  annotationIcon,
}: {
  viewer: OpenSeadragon.Viewer;
  annotations: Annotation[];
  annotationIcon: (type: string) => React.ReactNode;
}) {
  const [positions, setPositions] = useState<Record<string, { left: number; top: number }>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const newPos: Record<string, { left: number; top: number }> = {};
      annotations.forEach((a) => {
        const point = viewer.viewport.imageToViewerElementCoordinates(
          new OpenSeadragon.Point(a.x, a.y)
        );
        newPos[a.id] = { left: point.x, top: point.y };
      });
      setPositions(newPos);
    };

    viewer.addHandler("animation", update);
    viewer.addHandler("open", update);
    setTimeout(update, 300);

    return () => {
      viewer.removeHandler("animation", update);
      viewer.removeHandler("open", update);
    };
  }, [viewer, annotations]);

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {annotations.map((a) => {
        const pos = positions[a.id];
        if (!pos) return null;
        const isExpanded = expanded === a.id;

        return (
          <div
            key={a.id}
            className="absolute pointer-events-auto"
            style={{ left: pos.left, top: pos.top, transform: "translate(-50%, -50%)" }}
          >
            <button
              className={`group relative flex items-center justify-center rounded-full transition-all shadow-lg ${
                isExpanded
                  ? "w-6 h-6 bg-amber-500 text-black"
                  : "w-5 h-5 bg-white/90 text-black hover:bg-amber-400 hover:scale-125"
              }`}
              onClick={() => setExpanded(isExpanded ? null : a.id)}
            >
              {annotationIcon(a.annotation_type)}
            </button>

            {isExpanded && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-black/90 backdrop-blur-xl border border-white/20 rounded-lg p-3 min-w-[200px] max-w-[280px] text-left shadow-2xl z-50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-white">{a.label}</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-white/20 text-white/60 capitalize">
                    {a.annotation_type}
                  </Badge>
                </div>
                {a.content && (
                  <div className="space-y-1 text-[11px] text-white/70">
                    {a.content.material && (
                      <div className="flex items-center gap-1.5">
                        <Layers className="h-3 w-3 text-white/40 flex-shrink-0" />
                        <span>{a.content.material}</span>
                      </div>
                    )}
                    {a.content.dimensions && (
                      <div className="flex items-center gap-1.5">
                        <Ruler className="h-3 w-3 text-white/40 flex-shrink-0" />
                        <span>{a.content.dimensions}</span>
                      </div>
                    )}
                    {a.content.price_on_request && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-white/40 flex-shrink-0 text-[10px] font-bold w-3 text-center">$</span>
                        <span className="italic">Price on request</span>
                      </div>
                    )}
                    {a.content.notes && (
                      <p className="text-white/50 mt-1 leading-relaxed">{a.content.notes}</p>
                    )}
                  </div>
                )}
                <button
                  className="absolute top-1.5 right-1.5 text-white/30 hover:text-white/60"
                  onClick={() => setExpanded(null)}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
