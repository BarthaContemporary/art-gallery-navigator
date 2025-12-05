import { CRMCampaign } from "@/types/crm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface CampaignsListProps { campaigns: CRMCampaign[]; isLoading: boolean; }

const statusColors: Record<string, string> = { draft: "secondary", scheduled: "outline", sent: "default", archived: "secondary" };

export function CampaignsList({ campaigns, isLoading }: CampaignsListProps) {
  if (isLoading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  if (campaigns.length === 0) return <div className="text-center py-12 text-muted-foreground">No campaigns yet</div>;

  return (
    <div className="space-y-4">
      {campaigns.map((campaign) => (
        <Card key={campaign.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{campaign.name}</CardTitle>
              <Badge variant={statusColors[campaign.status] as any}>{campaign.status}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <span>List: {campaign.list?.name || "None"}</span>
              <span>Recipients: {campaign.total_recipients}</span>
              {campaign.sent_at && <span>Sent: {format(new Date(campaign.sent_at), "MMM d, yyyy")}</span>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
