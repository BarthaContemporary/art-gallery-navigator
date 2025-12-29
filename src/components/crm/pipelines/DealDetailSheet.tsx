import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { CRMDeal, CRMPipelineStage } from "@/types/crm";
import { useDeleteCRMDeal, useUpdateCRMDeal } from "@/hooks/crm";
import { calculateWeightedValue } from "@/hooks/crm/use-crm-deal-items";
import { DealInteractionsTimeline } from "./DealInteractionsTimeline";
import { DealArtworksSection } from "./DealArtworksSection";
import { Building2, User, Calendar, Trash2, Edit, DollarSign, Percent, Check, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface DealDetailSheetProps {
  deal: CRMDeal | null;
  stages: CRMPipelineStage[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}

export function DealDetailSheet({ deal, stages, open, onOpenChange, onEdit }: DealDetailSheetProps) {
  const deleteDeal = useDeleteCRMDeal();
  const updateDeal = useUpdateCRMDeal();
  
  const [isEditingProbability, setIsEditingProbability] = useState(false);
  const [probabilityValue, setProbabilityValue] = useState("");

  const handleDelete = async () => {
    if (!deal) return;
    if (!confirm(`Are you sure you want to delete "${deal.name}"?`)) return;
    
    await deleteDeal.mutateAsync(deal.id);
    onOpenChange(false);
    toast.success("Deal deleted");
  };

  const handleEditProbability = () => {
    setProbabilityValue(String(deal?.probability || 0));
    setIsEditingProbability(true);
  };

  const handleSaveProbability = async () => {
    if (!deal) return;
    const newProbability = Math.min(100, Math.max(0, parseInt(probabilityValue) || 0));
    await updateDeal.mutateAsync({ id: deal.id, probability: newProbability });
    setIsEditingProbability(false);
    toast.success("Probability updated");
  };

  const handleCancelProbability = () => {
    setIsEditingProbability(false);
  };

  if (!deal) return null;

  const stage = stages.find(s => s.id === deal.stage_id);
  const displayValue = deal.value || 0;
  const weightedValue = calculateWeightedValue(displayValue, deal.probability || 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: deal.currency || 'GBP',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl">{deal.name}</SheetTitle>
              {stage && (
                <Badge 
                  variant="outline" 
                  className="mt-2"
                  style={{ borderColor: stage.color, color: stage.color }}
                >
                  {stage.name}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mr-12">
              <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full opacity-70 hover:opacity-100" onClick={onEdit}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full opacity-70 hover:opacity-100" onClick={handleDelete} disabled={deleteDeal.isPending}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Value Summary */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" />Deal Value
              </p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(displayValue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <Percent className="h-3 w-3" />Weighted Value
              </p>
              {isEditingProbability ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={probabilityValue}
                    onChange={(e) => setProbabilityValue(e.target.value)}
                    className="w-16 h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveProbability();
                      if (e.key === 'Escape') handleCancelProbability();
                    }}
                  />
                  <span className="text-sm">%</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSaveProbability}>
                    <Check className="h-3 w-3 text-green-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCancelProbability}>
                    <X className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={handleEditProbability}
                  className="text-left hover:bg-muted/50 rounded px-1 -ml-1 transition-colors"
                >
                  <span className="text-xl font-semibold">{formatCurrency(weightedValue)}</span>
                  <span className="text-sm text-muted-foreground ml-1">({deal.probability || 0}%)</span>
                </button>
              )}
            </div>
          </div>

          {/* Contacts & Organization */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Contact Details</h3>
            
            {/* Multiple contacts */}
            {deal.contacts && deal.contacts.length > 0 ? (
              <div className="space-y-2">
                {deal.contacts.map((dealContact) => (
                  <div key={dealContact.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{dealContact.contact?.full_name}</p>
                        {dealContact.is_primary && (
                          <Badge variant="secondary" className="text-xs">Primary</Badge>
                        )}
                      </div>
                      {dealContact.contact?.email && (
                        <p className="text-sm text-muted-foreground">{dealContact.contact.email}</p>
                      )}
                      {dealContact.role && (
                        <p className="text-xs text-muted-foreground">{dealContact.role}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : deal.contact ? (
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <User className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{deal.contact.full_name}</p>
                  {deal.contact.email && (
                    <p className="text-sm text-muted-foreground">{deal.contact.email}</p>
                  )}
                </div>
              </div>
            ) : null}
            
            {deal.organization && (
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{deal.organization.name}</p>
                  {deal.organization.type && (
                    <p className="text-sm text-muted-foreground capitalize">{deal.organization.type}</p>
                  )}
                </div>
              </div>
            )}
            {(!deal.contacts || deal.contacts.length === 0) && !deal.contact && !deal.organization && (
              <p className="text-sm text-muted-foreground">No contact or organization assigned</p>
            )}
          </div>

          <Separator />

          {/* Expected Close Date */}
          {deal.expected_close_date && (
            <div>
              <h3 className="text-sm font-medium mb-2">Expected Close Date</h3>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {format(new Date(deal.expected_close_date), 'MMMM d, yyyy')}
              </div>
            </div>
          )}

          {/* Notes */}
          {deal.notes && (
            <div>
              <h3 className="text-sm font-medium mb-2">Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{deal.notes}</p>
            </div>
          )}

          <Separator />

          {/* Artworks */}
          <DealArtworksSection 
            dealId={deal.id} 
            relatedArtworks={deal.related_artworks || []}
            onUpdateArtworks={(artworkIds) => {
              updateDeal.mutate({ id: deal.id, related_artworks: artworkIds });
            }}
          />

          <Separator />

          {/* Interactions Timeline */}
          <DealInteractionsTimeline dealId={deal.id} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
