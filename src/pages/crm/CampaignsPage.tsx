import { CMListsManager } from "@/components/crm/campaigns/CMListsManager";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CampaignsPage() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" asChild>
          <a 
            href="https://barthacontemporary.createsend.com/" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Campaign Monitor
          </a>
        </Button>
      </div>

      <CMListsManager />
    </div>
  );
}
