import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useCRMCampaigns } from "@/hooks/crm";
import { CampaignsList } from "@/components/crm/campaigns/CampaignsList";
import { CampaignDialog } from "@/components/crm/campaigns/CampaignDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CRMCampaignStatus } from "@/types/crm";

export default function CampaignsPage() {
  const [activeTab, setActiveTab] = useState<CRMCampaignStatus | "all">("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: campaigns, isLoading } = useCRMCampaigns({
    status: activeTab === "all" ? undefined : activeTab,
  });

  const draftCampaigns = campaigns?.filter(c => c.status === "draft") || [];
  const sentCampaigns = campaigns?.filter(c => c.status === "sent") || [];

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campaigns</h1>
          <p className="text-muted-foreground text-sm">
            {campaigns?.length || 0} campaigns
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CRMCampaignStatus | "all")}>
        <TabsList>
          <TabsTrigger value="all">All ({campaigns?.length || 0})</TabsTrigger>
          <TabsTrigger value="draft">Drafts ({draftCampaigns.length})</TabsTrigger>
          <TabsTrigger value="sent">Sent ({sentCampaigns.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <CampaignsList campaigns={campaigns || []} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="draft" className="mt-6">
          <CampaignsList campaigns={draftCampaigns} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="sent" className="mt-6">
          <CampaignsList campaigns={sentCampaigns} isLoading={isLoading} />
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      <CampaignDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}
