
import { Button } from "@/components/ui/button";
import { Users, Folder } from "lucide-react";
import { useCurrentUserArtist } from "@/hooks/useCurrentUserArtist";

interface ArtistFolderNavigationProps {
  onNavigateToArtistFolder: () => void;
}

export function ArtistFolderNavigation({ onNavigateToArtistFolder }: ArtistFolderNavigationProps) {
  const currentUserArtist = useCurrentUserArtist();

  if (!currentUserArtist) {
    return null;
  }

  return (
    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-blue-600" />
          <div>
            <h3 className="font-medium text-blue-900">Your Files</h3>
            <p className="text-sm text-blue-700">Access your personal file folder</p>
          </div>
        </div>
        <Button onClick={onNavigateToArtistFolder} variant="outline" size="sm">
          <Folder className="h-4 w-4 mr-2" />
          Open My Folder
        </Button>
      </div>
    </div>
  );
}
