import { useState } from "react";
import { CRMPipeline, CRMDeal, CRMPipelineStage } from "@/types/crm";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DndContext, DragEndEvent, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useMoveDealToStage } from "@/hooks/crm";
import { DealCard } from "./DealCard";
import { DealDetailSheet } from "./DealDetailSheet";
import { DealDialog } from "./DealDialog";
import { Card, CardContent } from "@/components/ui/card";

interface PipelineBoardProps { pipeline: CRMPipeline; deals: CRMDeal[]; isLoading: boolean; }

interface StageColumnProps {
  stage: CRMPipelineStage;
  deals: CRMDeal[];
  onDealClick: (deal: CRMDeal) => void;
}

function StageColumn({ stage, deals, onDealClick }: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  
  return (
    <div key={stage.id} className="w-72 flex-shrink-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
        <h3 className="font-medium">{stage.name}</h3>
        <Badge variant="secondary" className="ml-auto">{deals.length}</Badge>
      </div>
      <SortableContext items={deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
        <div 
          ref={setNodeRef}
          className={`space-y-2 min-h-[200px] p-2 rounded-lg border border-dashed transition-colors ${
            isOver ? 'bg-primary/10 border-primary' : 'bg-muted/30'
          }`}
          data-stage-id={stage.id}
        >
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} onClick={() => onDealClick(deal)} />
          ))}
          {deals.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">Drop deals here</p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function PipelineBoard({ pipeline, deals, isLoading }: PipelineBoardProps) {
  const [selectedDeal, setSelectedDeal] = useState<CRMDeal | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [activeDeal, setActiveDeal] = useState<CRMDeal | null>(null);
  
  const moveDeal = useMoveDealToStage();
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  if (isLoading) return <div className="flex gap-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-96 w-64 flex-shrink-0" />)}</div>;

  const stages = pipeline.stages || [];
  const dealsByStage = stages.reduce((acc, stage) => {
    acc[stage.id] = deals.filter(d => d.stage_id === stage.id);
    return acc;
  }, {} as Record<string, CRMDeal[]>);

  // Calculate pipeline stats
  const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
  const weightedValue = deals.reduce((sum, d) => sum + ((d.value || 0) * ((d.probability || 0) / 100)), 0);

  const handleDragStart = (event: any) => {
    const deal = deals.find(d => d.id === event.active.id);
    setActiveDeal(deal || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDeal(null);
    const { active, over } = event;
    if (!over) return;

    const dealId = active.id as string;
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;

    // Check if dropped on a stage column (droppable) or another deal
    let targetStageId: string | undefined;
    
    // First check if it's a stage
    const droppedOnStage = stages.find(s => s.id === over.id);
    if (droppedOnStage) {
      targetStageId = droppedOnStage.id;
    } else {
      // Check if dropped on another deal, get that deal's stage
      const droppedOnDeal = deals.find(d => d.id === over.id);
      if (droppedOnDeal) {
        targetStageId = droppedOnDeal.stage_id;
      }
    }
    
    if (targetStageId && targetStageId !== deal.stage_id) {
      moveDeal.mutate({ dealId, stageId: targetStageId, displayOrder: 0 });
    }
  };

  const handleDealClick = (deal: CRMDeal) => {
    setSelectedDeal(deal);
    setIsDetailOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div className="space-y-4">
      {/* Pipeline Stats */}
      <div className="flex gap-6 p-3 bg-muted/30 rounded-lg">
        <div>
          <p className="text-xs text-muted-foreground">Total Pipeline</p>
          <p className="text-lg font-bold">{formatCurrency(totalValue)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Weighted Forecast</p>
          <p className="text-lg font-semibold">{formatCurrency(weightedValue)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Deals</p>
          <p className="text-lg font-semibold">{deals.length}</p>
        </div>
      </div>

      {/* Kanban Board */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              deals={dealsByStage[stage.id] || []}
              onDealClick={handleDealClick}
            />
          ))}
        </div>
        <DragOverlay>
          {activeDeal && (
            <Card className="w-72 opacity-90 shadow-lg">
              <CardContent className="p-3">
                <p className="font-medium text-sm">{activeDeal.name}</p>
                {activeDeal.value && <p className="text-sm text-primary font-semibold mt-1">{formatCurrency(activeDeal.value)}</p>}
              </CardContent>
            </Card>
          )}
        </DragOverlay>
      </DndContext>

      {/* Detail Sheet */}
      <DealDetailSheet
        deal={selectedDeal}
        stages={stages}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onEdit={() => { setIsDetailOpen(false); setIsEditOpen(true); }}
      />

      {/* Edit Dialog */}
      <DealDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        pipelineId={pipeline.id}
        stages={stages}
        deal={selectedDeal}
      />
    </div>
  );
}
