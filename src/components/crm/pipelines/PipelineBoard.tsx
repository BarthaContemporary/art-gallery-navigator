import { CRMPipeline, CRMDeal } from "@/types/crm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface PipelineBoardProps { pipeline: CRMPipeline; deals: CRMDeal[]; isLoading: boolean; }

export function PipelineBoard({ pipeline, deals, isLoading }: PipelineBoardProps) {
  if (isLoading) return <div className="flex gap-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-96 w-64 flex-shrink-0" />)}</div>;

  const stages = pipeline.stages || [];
  const dealsByStage = stages.reduce((acc, stage) => {
    acc[stage.id] = deals.filter(d => d.stage_id === stage.id);
    return acc;
  }, {} as Record<string, CRMDeal[]>);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => (
        <div key={stage.id} className="w-72 flex-shrink-0">
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-3 h-3" style={{ backgroundColor: stage.color }} />
            <h3 className="font-medium">{stage.name}</h3>
            <Badge variant="secondary" className="ml-auto">{dealsByStage[stage.id]?.length || 0}</Badge>
          </div>
          <div className="space-y-2 min-h-[200px] bg-muted/30 p-2 border border-dashed">
            {dealsByStage[stage.id]?.map((deal) => (
              <Card key={deal.id} className="cursor-pointer hover:border-primary/50">
                <CardHeader className="p-3 pb-1">
                  <CardTitle className="text-sm">{deal.name}</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  {deal.contact && <p className="text-xs text-muted-foreground">{deal.contact.full_name}</p>}
                  {deal.value && <p className="text-sm font-medium mt-1">{deal.currency} {deal.value.toLocaleString()}</p>}
                </CardContent>
              </Card>
            ))}
            {(!dealsByStage[stage.id] || dealsByStage[stage.id].length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-4">No deals</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
