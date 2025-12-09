import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CMCampaignsList } from "@/components/crm/campaigns/CMCampaignsList";
import { CMListsManager } from "@/components/crm/campaigns/CMListsManager";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CampaignsPage() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground text-xs">
            Campaign Monitor Integration
          </p>
        </div>
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

      <Tabs defaultValue="campaigns">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="lists">Lists</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-4">
          <CMCampaignsList />
        </TabsContent>

        <TabsContent value="lists" className="mt-4">
          <CMListsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
