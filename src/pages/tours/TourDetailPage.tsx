import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Image, MapPin, Settings, Eye, Trash2, GripVertical, Camera, Grid3X3 } from "lucide-react";
import { toast } from "sonner";
import { MobileCaptureWizard } from "@/components/tours/MobileCaptureWizard";
import { FloorplanSketchTool } from "@/components/tours/FloorplanSketchTool";

type NodeType = "panorama" | "image_set";

interface TourNode {
  id: string;
  name: string;
  node_type: NodeType;
  position_index: number;
  panorama_url: string | null;
  floorplan_x: number | null;
  floorplan_y: number | null;
  created_at: string;
  tour_node_images: { id: string }[];
}

export default function TourDetailPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createNodeOpen, setCreateNodeOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState(false);
  const [nodeName, setNodeName] = useState("");
  const [nodeType, setNodeType] = useState<NodeType>("image_set");
  const isMobile = useIsMobile();
  const [showFloorplan, setShowFloorplan] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["tour-project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tour_projects")
        .select("*")
        .eq("id", projectId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const { data: nodes = [], isLoading: nodesLoading } = useQuery({
    queryKey: ["tour-nodes", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tour_nodes")
        .select("*, tour_node_images(id)")
        .eq("project_id", projectId!)
        .order("position_index", { ascending: true });
      if (error) throw error;
      return data as TourNode[];
    },
    enabled: !!projectId,
  });

  const createNodeMutation = useMutation({
    mutationFn: async () => {
      const nextIndex = nodes.length > 0 ? Math.max(...nodes.map(n => n.position_index)) + 1 : 0;
      const { error } = await supabase.from("tour_nodes").insert({
        project_id: projectId!,
        name: nodeName,
        node_type: nodeType,
        position_index: nextIndex,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-nodes", projectId] });
      toast.success("Node created");
      setCreateNodeOpen(false);
      setNodeName("");
      setNodeType("image_set");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteNodeMutation = useMutation({
    mutationFn: async (nodeId: string) => {
      const { error } = await supabase.from("tour_nodes").delete().eq("id", nodeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-nodes", projectId] });
      toast.success("Node deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Tour not found</p>
        <Button variant="ghost" className="mt-2" onClick={() => navigate("/tours")}>Back to tours</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mobile Capture Wizard */}
      {captureMode && projectId && (
        <MobileCaptureWizard
          projectId={projectId}
          onComplete={() => {
            setCaptureMode(false);
            queryClient.invalidateQueries({ queryKey: ["tour-nodes", projectId] });
          }}
          onClose={() => setCaptureMode(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/tours")} className="mt-0.5">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{project.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs capitalize">{project.visibility}</Badge>
              {project.location && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />{project.location}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/tour-viewer/${projectId}`)}>
            <Eye className="h-4 w-4 mr-1.5" />
            Preview
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-1.5" />
            Settings
          </Button>
        </div>
      </div>

      {/* Mobile Capture Mode Button */}
      {isMobile && (
        <Button
          onClick={() => setCaptureMode(true)}
          className="w-full h-14 text-base"
          size="xl"
        >
          <Camera className="h-5 w-5 mr-2" />
          Start Capture Mode
        </Button>
      )}

      {/* Nodes Section */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Scan Positions</h2>
        <Dialog open={createNodeOpen} onOpenChange={setCreateNodeOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1.5" />
              Add Node
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Scan Position</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={nodeName} onChange={(e) => setNodeName(e.target.value)} placeholder="e.g. Entrance Hall" />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={nodeType} onValueChange={(v) => setNodeType(v as NodeType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image_set">Image Set (deep zoom)</SelectItem>
                    <SelectItem value="panorama">Panorama (360°)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => createNodeMutation.mutate()} disabled={!nodeName.trim() || createNodeMutation.isPending} className="w-full">
                {createNodeMutation.isPending ? "Creating..." : "Add Node"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {nodesLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-16 w-16 bg-muted rounded" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : nodes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MapPin className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <h3 className="font-medium">No scan positions yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Add your first scan position to start building the tour. Each position represents a viewpoint in the space.
            </p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setCreateNodeOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add First Node
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {nodes.map((node, idx) => (
            <Card
              key={node.id}
              className="cursor-pointer hover:shadow-sm transition-shadow"
              onClick={() => navigate(`/tours/${projectId}/nodes/${node.id}`)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="text-muted-foreground/40">
                  <GripVertical className="h-4 w-4" />
                </div>
                <div className="h-14 w-14 bg-muted rounded flex items-center justify-center flex-shrink-0">
                  {node.node_type === "panorama" ? (
                    <span className="text-lg">🌐</span>
                  ) : (
                    <Image className="h-5 w-5 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{node.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-xs capitalize">
                      {node.node_type === "panorama" ? "360° Panorama" : "Image Set"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {node.tour_node_images?.length || 0} image{node.tour_node_images?.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this node?")) deleteNodeMutation.mutate(node.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Floorplan Section */}
      {nodes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <Grid3X3 className="h-5 w-5 text-muted-foreground" />
              Floorplan
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFloorplan(!showFloorplan)}
            >
              {showFloorplan ? "Hide" : "Show"} Map
            </Button>
          </div>
          {showFloorplan && (
            <FloorplanSketchTool projectId={projectId!} nodes={nodes as any} />
          )}
        </div>
      )}
    </div>
  );
}
