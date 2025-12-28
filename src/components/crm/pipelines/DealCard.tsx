import { CRMDeal } from "@/types/crm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, User, Calendar, Percent } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";

interface DealCardProps {
  deal: CRMDeal;
  onClick: () => void;
}

export function DealCard({ deal, onClick }: DealCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const formatCurrency = (value: number, currency: string = "GBP") => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-md transition-all"
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm leading-tight line-clamp-2">{deal.name}</h4>
          {deal.probability !== undefined && deal.probability > 0 && (
            <Badge variant="outline" className="text-xs shrink-0">
              <Percent className="h-2.5 w-2.5 mr-0.5" />
              {deal.probability}%
            </Badge>
          )}
        </div>

        {/* Contact & Organization */}
        <div className="space-y-1">
          {deal.contact && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span className="truncate">{deal.contact.full_name}</span>
            </div>
          )}
          {deal.organization && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span className="truncate">{deal.organization.name}</span>
            </div>
          )}
        </div>

        {/* Value & Close Date */}
        <div className="flex items-center justify-between pt-1 border-t">
          {deal.value ? (
            <span className="text-sm font-semibold text-primary">
              {formatCurrency(deal.value, deal.currency || 'GBP')}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">No value</span>
          )}
          {deal.expected_close_date && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {format(new Date(deal.expected_close_date), 'MMM d')}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
