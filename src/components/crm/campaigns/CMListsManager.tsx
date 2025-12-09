import { useCampaignMonitorLists, useSyncAllContacts, useImportFromList } from "@/hooks/crm/use-campaign-monitor";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Download, RefreshCw, Users } from "lucide-react";

export function CMListsManager() {
  const { data: lists, isLoading, error } = useCampaignMonitorLists();
  const syncMutation = useSyncAllContacts();
  const importMutation = useImportFromList();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
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
            <span>Failed to load lists. Check your Campaign Monitor configuration.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!lists || lists.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No subscriber lists found in Campaign Monitor.
        </CardContent>
      </Card>
    );
  }

  const isPending = syncMutation.isPending || importMutation.isPending;

  return (
    <div className="space-y-3">
      {lists.map((list) => (
        <Card key={list.ListID}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-medium">{list.Name}</h3>
                  <p className="text-xs text-muted-foreground">ID: {list.ListID}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => importMutation.mutate(list.ListID)}
                  disabled={isPending}
                >
                  <Download className={`h-4 w-4 mr-2 ${importMutation.isPending ? 'animate-pulse' : ''}`} />
                  Import to CRM
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncMutation.mutate(list.ListID)}
                  disabled={isPending}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                  Export to CM
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
