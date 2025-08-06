import { CollectionGrid } from "@/components/collections/CollectionGrid";
import { CollectionDialog } from "@/components/collections/CollectionDialog";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
export default function Collections() {
  const navigate = useNavigate();
  const {
    isAdmin
  } = useAuth();
  const handleManageAllWebsites = () => {
    navigate("/manage-websites");
  };
  return <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="space-y-8">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            
            <div className="flex items-center gap-3">
              {isAdmin && <Button variant="outline" size="sm" onClick={handleManageAllWebsites} className="whitespace-nowrap">
                  <Globe className="h-4 w-4 mr-2" />
                  Manage Websites
                </Button>}
              <CollectionDialog />
            </div>
          </div>

          {/* Collections Grid */}
          <div className="animate-fade-in">
            <CollectionGrid />
          </div>
        </div>
      </div>
    </div>;
}