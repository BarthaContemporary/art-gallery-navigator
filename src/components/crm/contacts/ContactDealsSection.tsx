import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useContactDeals } from "@/hooks/crm/use-contact-deals";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Briefcase, Calendar, Building2, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface ContactDealsSectionProps {
  contactId: string;
}

export function ContactDealsSection({ contactId }: ContactDealsSectionProps) {
  const { data: deals = [], isLoading } = useContactDeals(contactId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deals</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number | null, currency: string | null) => {
    if (value === null) return null;
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'won': return 'bg-green-500/10 text-green-600 border-green-200';
      case 'lost': return 'bg-red-500/10 text-red-600 border-red-200';
      case 'open': return 'bg-blue-500/10 text-blue-600 border-blue-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Briefcase className="h-4 w-4" />
          Deals ({deals.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {deals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deals linked to this contact</p>
        ) : (
          deals.map((dealContact) => {
            const deal = dealContact.deal;
            return (
              <Link
                key={dealContact.id}
                to="/crm/pipelines"
                className="block p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{deal.name}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {deal.stage && (
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{
                            borderColor: deal.stage.color || undefined,
                            backgroundColor: deal.stage.color ? `${deal.stage.color}15` : undefined,
                          }}
                        >
                          {deal.stage.name}
                        </Badge>
                      )}
                      <Badge variant="outline" className={`text-xs ${getStatusColor(deal.status)}`}>
                        {deal.status || 'open'}
                      </Badge>
                      {dealContact.role && (
                        <span className="text-xs text-muted-foreground">
                          ({dealContact.role})
                        </span>
                      )}
                    </div>
                  </div>
                  {deal.value !== null && (
                    <span className="font-semibold text-sm shrink-0">
                      {formatCurrency(deal.value, deal.currency)}
                    </span>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                  {deal.probability !== null && (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {deal.probability}%
                    </span>
                  )}
                  {deal.expected_close_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(deal.expected_close_date), 'MMM d, yyyy')}
                    </span>
                  )}
                  {deal.organization && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {deal.organization.name}
                    </span>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
