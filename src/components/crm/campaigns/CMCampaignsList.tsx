import { useState } from "react";
import { useCampaignMonitorCampaigns, useCampaignSummary } from "@/hooks/crm/use-campaign-monitor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink, Mail, MousePointer, Users, AlertCircle, Eye } from "lucide-react";
import { format } from "date-fns";

export function CMCampaignsList() {
  const { data: campaigns, isLoading, error } = useCampaignMonitorCampaigns();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const { data: summary, isLoading: summaryLoading } = useCampaignSummary(selectedCampaignId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Failed to load campaigns. Check your Campaign Monitor configuration.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const allCampaigns = [
    ...(campaigns?.sent || []).map(c => ({ ...c, status: 'sent' })),
    ...(campaigns?.scheduled || []).map(c => ({ ...c, status: 'scheduled' })),
    ...(campaigns?.drafts || []).map(c => ({ ...c, status: 'draft' })),
  ];

  if (allCampaigns.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No campaigns found in Campaign Monitor.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {allCampaigns.map((campaign) => (
          <Card key={campaign.CampaignID} className="hover:bg-muted/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{campaign.Name}</h3>
                    <Badge variant={
                      campaign.status === 'sent' ? 'default' :
                      campaign.status === 'scheduled' ? 'secondary' : 'outline'
                    }>
                      {campaign.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{campaign.Subject}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>From: {campaign.FromName}</span>
                    {campaign.SentDate && (
                      <span>Sent: {format(new Date(campaign.SentDate), 'MMM d, yyyy')}</span>
                    )}
                    {campaign.TotalRecipients && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {campaign.TotalRecipients}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {campaign.status === 'sent' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCampaignId(campaign.CampaignID)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  {campaign.WebVersionURL && (
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                    >
                      <a href={campaign.WebVersionURL} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedCampaignId} onOpenChange={() => setSelectedCampaignId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Campaign Analytics</DialogTitle>
          </DialogHeader>
          {summaryLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : summary ? (
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Recipients
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{summary.Recipients}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Opens
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{summary.UniqueOpened}</p>
                  <p className="text-xs text-muted-foreground">
                    {summary.Recipients > 0 
                      ? `${((summary.UniqueOpened / summary.Recipients) * 100).toFixed(1)}% rate`
                      : '0% rate'
                    }
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MousePointer className="h-4 w-4" />
                    Clicks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{summary.Clicks}</p>
                  <p className="text-xs text-muted-foreground">
                    {summary.Recipients > 0 
                      ? `${((summary.Clicks / summary.Recipients) * 100).toFixed(1)}% rate`
                      : '0% rate'
                    }
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Bounced
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{summary.Bounced}</p>
                  <p className="text-xs text-muted-foreground">
                    {summary.Unsubscribed} unsubscribed
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-muted-foreground">No analytics available</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
