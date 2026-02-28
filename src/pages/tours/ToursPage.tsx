import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Camera, Globe, Lock, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

type TourVisibility = "private" | "unlisted" | "public";

interface TourProject {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  location: string | null;
  visibility: TourVisibility;
  created_at: string;
  updated_at: string;
}

export default function ToursPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [visibility, setVisibility] = useState<TourVisibility>("private");
  const [deleteTarget, setDeleteTarget] = useState<TourProject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: tours = [], isLoading } = useQuery({
    queryKey: ["tour-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tour_projects")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const projects = data as TourProject[];

      // For projects without a cover image, fetch the first image from the first node
      const needsCover = projects.filter((p) => !p.cover_image_url);
      if (needsCover.length > 0) {
        const projectIds = needsCover.map((p) => p.id);
        // Get the first node per project (lowest display_order)
        const { data: nodes } = await supabase
          .from("tour_nodes")
          .select("id, project_id, position_index")
          .in("project_id", projectIds)
          .order("position_index", { ascending: true });

        if (nodes && nodes.length > 0) {
          // Pick first node per project
          const firstNodeByProject = new Map<string, string>();
          for (const n of nodes) {
            if (!firstNodeByProject.has(n.project_id)) {
              firstNodeByProject.set(n.project_id, n.id);
            }
          }
          const nodeIds = Array.from(firstNodeByProject.values());

          // Get the first image per node (lowest display_order)
          const { data: images } = await supabase
            .from("tour_node_images")
            .select("node_id, original_url, thumbnail_url, medium_url")
            .in("node_id", nodeIds)
            .order("display_order", { ascending: true });

          if (images && images.length > 0) {
            const firstImageByNode = new Map<string, string>();
            for (const img of images) {
              if (!firstImageByNode.has(img.node_id)) {
                firstImageByNode.set(img.node_id, img.thumbnail_url || img.medium_url || img.original_url);
              }
            }
            // Map back to projects
            for (const p of projects) {
              if (!p.cover_image_url) {
                const nodeId = firstNodeByProject.get(p.id);
                if (nodeId) {
                  p.cover_image_url = firstImageByNode.get(nodeId) || null;
                }
              }
            }
          }
        }
      }

      return projects;
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("tour_projects")
        .insert({
          title,
          description: description || null,
          location: location || null,
          visibility,
          owner_id: user!.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tour-projects"] });
      toast.success("Tour project created");
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      setLocation("");
      setVisibility("private");
      navigate(`/tours/${data.id}`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleDeleteTour = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      // Delete related data in order: images → nodes → hotspots → collaborators → share links → floorplans → processing jobs → project
      const { data: nodeIds } = await supabase
        .from("tour_nodes")
        .select("id")
        .eq("project_id", deleteTarget.id);

      if (nodeIds && nodeIds.length > 0) {
        const ids = nodeIds.map(n => n.id);
        // Delete processing jobs linked to nodes
        await (supabase.from("tour_processing_jobs").delete() as any).in("node_id", ids);
        await (supabase.from("tour_node_images").delete() as any).in("node_id", ids);
        await (supabase.from("tour_hotspots").delete() as any).in("source_node_id", ids);
        await (supabase.from("tour_hotspots").delete() as any).in("target_node_id", ids);
      }

      await supabase.from("tour_nodes").delete().eq("project_id", deleteTarget.id);
      await supabase.from("tour_collaborators").delete().eq("project_id", deleteTarget.id);
      await supabase.from("tour_share_links").delete().eq("project_id", deleteTarget.id);
      await supabase.from("tour_floorplans").delete().eq("project_id", deleteTarget.id);

      const { error } = await supabase.from("tour_projects").delete().eq("id", deleteTarget.id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["tour-projects"] });
      toast.success(`"${deleteTarget.title}" deleted`);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error("Failed to delete tour: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const visibilityIcon = (v: TourVisibility) => {
    if (v === "public") return <Globe className="h-3.5 w-3.5" />;
    if (v === "unlisted") return <Eye className="h-3.5 w-3.5" />;
    return <Lock className="h-3.5 w-3.5" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">PhotoTour Studio</h1>
          <p className="text-sm text-muted-foreground mt-1">Create interactive photo tours of spaces</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              New Tour
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Tour Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Gallery Ground Floor" />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional location" />
              </div>
              <div className="space-y-1.5">
                <Label>Visibility</Label>
                <Select value={visibility} onValueChange={(v) => setVisibility(v as TourVisibility)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="unlisted">Unlisted</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!title.trim() || createMutation.isPending} className="w-full">
                {createMutation.isPending ? "Creating..." : "Create Tour"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="aspect-video bg-muted" />
              <CardContent className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : tours.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Camera className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium">No tours yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Create your first interactive photo tour. Upload images, connect scan positions, and share immersive experiences.
            </p>
            <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create Tour
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tours.map((tour) => (
            <Card
              key={tour.id}
              className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden group"
              onClick={() => navigate(`/tours/${tour.id}`)}
            >
              <div className="aspect-video bg-muted relative overflow-hidden">
                {tour.cover_image_url ? (
                  <img src={tour.cover_image_url} alt={tour.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Camera className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}
                <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  {visibilityIcon(tour.visibility)}
                  {tour.visibility}
                </div>
              </div>
              <CardContent className="p-4 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium truncate">{tour.title}</h3>
                  {tour.location && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{tour.location}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Updated {format(new Date(tour.updated_at), "MMM d, yyyy")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(tour);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tour project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.title}" and all its scan positions, images, hotspots, and share links. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTour}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Tour"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
