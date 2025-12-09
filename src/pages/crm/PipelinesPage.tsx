import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useCRMPipelines, useCRMDeals } from "@/hooks/crm";
import { PipelineBoard } from "@/components/crm/pipelines/PipelineBoard";
import { DealDialog } from "@/components/crm/pipelines/DealDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export default function PipelinesPage() {
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [isCreateDealOpen, setIsCreateDealOpen] = useState(false);

  const { data: pipelines, isLoading: pipelinesLoading } = useCRMPipelines();

  // Set default pipeline when loaded
  if (pipelines?.length && !selectedPipelineId) {
    setSelectedPipelineId(pipelines[0].id);
  }

  const selectedPipeline = pipelines?.find(p => p.id === selectedPipelineId);
  const { data: deals, isLoading: dealsLoading } = useCRMDeals(selectedPipelineId);

  if (pipelinesLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Pipelines</h1>
            <p className="text-muted-foreground text-sm">
              Track deals and opportunities
            </p>
          </div>
          {pipelines && pipelines.length > 1 && (
            <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select pipeline" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button onClick={() => setIsCreateDealOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Deal
        </Button>
      </div>

      {/* Pipeline Board */}
      {selectedPipeline && (
        <PipelineBoard
          pipeline={selectedPipeline}
          deals={deals || []}
          isLoading={dealsLoading}
        />
      )}

      {/* Deal Dialog */}
      <DealDialog
        open={isCreateDealOpen}
        onOpenChange={setIsCreateDealOpen}
        pipelineId={selectedPipelineId}
        stages={selectedPipeline?.stages || []}
      />
    </div>
  );
}
