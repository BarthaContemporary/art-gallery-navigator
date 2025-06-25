
import { EnhancedDocument, useToggleFavorite, useSoftDeleteDocument } from "@/hooks/use-enhanced-documents";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Download, Star, StarOff, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface DocumentActionsProps {
  document: EnhancedDocument;
}

export function DocumentActions({ document }: DocumentActionsProps) {
  const toggleFavoriteMutation = useToggleFavorite();
  const softDeleteMutation = useSoftDeleteDocument();

  const handleDownload = () => {
    window.open(document.file_url, '_blank');
  };

  const handleToggleFavorite = () => {
    toggleFavoriteMutation.mutate({
      documentId: document.id,
      isFavorite: !document.is_favorite
    });
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      softDeleteMutation.mutate(document.id);
    }
  };

  const handleView = () => {
    window.open(document.file_url, '_blank');
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleView}
        className="hidden sm:flex"
      >
        <ExternalLink className="h-4 w-4 mr-2" />
        View
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleView} className="sm:hidden">
            <ExternalLink className="h-4 w-4 mr-2" />
            View
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleToggleFavorite}>
            {document.is_favorite ? (
              <>
                <StarOff className="h-4 w-4 mr-2" />
                Remove from favorites
              </>
            ) : (
              <>
                <Star className="h-4 w-4 mr-2" />
                Add to favorites
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={handleDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
