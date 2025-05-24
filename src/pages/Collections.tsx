
import { CollectionGrid } from "@/components/collections/CollectionGrid";
import { CollectionDialog } from "@/components/collections/CollectionDialog";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { toast } from "sonner";

export default function Collections() {
  const handleManageAllWebsites = () => {
    toast.info("Global management of collection websites will be available here soon.");
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 sm:gap-0">
        <div /> {/* Empty div for spacing, or for future title/controls */}
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleManageAllWebsites}>
            <Globe className="mr-2 h-4 w-4" />
            Manage All Websites
          </Button>
          <CollectionDialog />
        </div>
      </div>
      <CollectionGrid />
    </div>
  );
}
