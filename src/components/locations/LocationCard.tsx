
import { Building, Warehouse, Briefcase, ExternalLink, MapPin, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Location } from "@/hooks/use-locations";
import { useState } from "react";
import { EditLocationDialog } from "./EditLocationDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const getLocationIcon = (type: string) => {
  switch (type) {
    case "exhibition":
      return <Building className="h-10 w-10 text-blue-500" />;
    case "storage":
      return <Warehouse className="h-10 w-10 text-amber-500" />;
    case "consignment":
      return <Briefcase className="h-10 w-10 text-purple-500" />;
    case "external":
      return <ExternalLink className="h-10 w-10 text-green-500" />;
    default:
      return <MapPin className="h-10 w-10 text-gray-500" />;
  }
};

interface LocationCardProps {
  location: Location;
  isAdmin: boolean;
}

export function LocationCard({ location, isAdmin }: LocationCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', location.id);

      if (error) throw error;

      toast.success("Location deleted successfully");
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error deleting location:', error);
      toast.error("Failed to delete location");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="group relative">
      {isAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              size="icon" 
              variant="ghost" 
              className="absolute top-2 right-2 h-8 w-8 bg-white/80 hover:bg-white shadow-sm z-10 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Edit className="h-4 w-4" />
              <span className="sr-only">Actions for {location.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setDeleteDialogOpen(true)}
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        {getLocationIcon(location.type)}
        <div>
          <h3 className="font-semibold text-lg">{location.name}</h3>
          <p className="text-sm text-muted-foreground capitalize">{location.type}</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <span className="text-sm">{location.address || "No address"}</span>
          </div>
          <p className="text-sm text-muted-foreground">{location.notes || ""}</p>
        </div>
      </CardContent>

      <EditLocationDialog
        location={location}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this location
              and may affect any artworks associated with it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
