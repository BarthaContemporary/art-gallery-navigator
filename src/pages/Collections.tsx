
import { CollectionGrid } from "@/components/collections/CollectionGrid";
import { CollectionDialog } from "@/components/collections/CollectionDialog";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

export default function Collections() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const handleManageAllWebsites = () => {
    navigate("/manage-websites");
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-6 gap-3 sm:gap-4">
        <div className="flex flex-wrap gap-2">
          <CollectionDialog />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {isAdmin && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleManageAllWebsites}
            >
              <Globe className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <CollectionGrid />
    </div>
  );
}
