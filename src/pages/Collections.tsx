
import { CollectionGrid } from "@/components/collections/CollectionGrid";
import { CollectionDialog } from "@/components/collections/CollectionDialog";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Collections() {
  const navigate = useNavigate();

  const handleManageAllWebsites = () => {
    navigate("/manage-websites");
  };

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-start sm:items-center justify-start mb-4 md:mb-6 gap-3 md:gap-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleManageAllWebsites}
          className="text-xs md:text-sm"
        >
          <Globe className="mr-1 h-3 w-3 md:mr-2 md:h-4 md:w-4" />
          Manage All Websites
        </Button>
        <CollectionDialog />
      </div>
      <CollectionGrid />
    </div>
  );
}
