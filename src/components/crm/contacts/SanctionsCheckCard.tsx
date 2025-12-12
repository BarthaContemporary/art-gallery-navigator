import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldAlert, ShieldCheck, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { useSanctionsCheck, SanctionsMatch } from "@/hooks/crm/use-sanctions-check";
import { CRMContact } from "@/types/crm";
import { cn } from "@/lib/utils";

interface SanctionsCheckCardProps {
  contact: CRMContact;
}

export function SanctionsCheckCard({ contact }: SanctionsCheckCardProps) {
  const { checkSanctions, loadSavedResult, isChecking, result, error } = useSanctionsCheck();
  const [expanded, setExpanded] = useState(false);

  // Load saved result on mount
  useEffect(() => {
    if (contact.sanctions_checked_at) {
      loadSavedResult({
        sanctions_checked_at: contact.sanctions_checked_at,
        sanctions_risk_level: contact.sanctions_risk_level,
        sanctions_match_count: contact.sanctions_match_count,
        sanctions_matches: contact.sanctions_matches,
      });
    }
  }, [contact.id]);

  const handleCheck = () => {
    checkSanctions({
      contactId: contact.id,
      name: contact.full_name,
      birthDate: contact.birthday || undefined,
      nationality: undefined,
      country: contact.country || undefined,
    });
  };

  const getRiskBadge = () => {
    if (!result?.checked) return null;
    
    switch (result.risk_level) {
      case 'high':
        return (
          <Badge variant="destructive" className="gap-1">
            <ShieldAlert className="h-3 w-3" />
            High Risk
          </Badge>
        );
      case 'medium':
        return (
          <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600">
            <AlertTriangle className="h-3 w-3" />
            Potential Match
          </Badge>
        );
      case 'clear':
        return (
          <Badge variant="outline" className="gap-1 border-green-500 text-green-600">
            <ShieldCheck className="h-3 w-3" />
            Clear
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            UK Sanctions Check
          </CardTitle>
          {getRiskBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!result && !error && (
          <div className="text-sm text-muted-foreground">
            <p>Check this contact against the UK Sanctions List (OFSI/HMT).</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={handleCheck}
              disabled={isChecking}
            >
              {isChecking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Run Sanctions Check
                </>
              )}
            </Button>
          </div>
        )}

        {error && !result?.checked && (
          <div className="text-sm text-destructive">
            <p>{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={handleCheck}
              disabled={isChecking}
            >
              Retry
            </Button>
          </div>
        )}

        {result?.checked && (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Last checked: {result.checked_at ? new Date(result.checked_at).toLocaleString() : 'Just now'}
            </div>

            {result.risk_level === 'clear' && (
              <p className="text-sm text-green-600">
                No matches found on UK sanctions lists.
              </p>
            )}

            {result.has_matches && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {result.match_count} potential match{result.match_count !== 1 ? 'es' : ''} found
                </p>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="text-xs"
                >
                  {expanded ? 'Hide details' : 'Show details'}
                </Button>

                {expanded && (
                  <div className="space-y-2 mt-2">
                    {result.matches.map((match: SanctionsMatch) => (
                      <div 
                        key={match.id}
                        className={cn(
                          "p-2 rounded border text-xs",
                          match.score >= 0.9 ? "border-destructive bg-destructive/5" : "border-yellow-500 bg-yellow-50"
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-medium">{match.caption}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {Math.round(match.score * 100)}% match
                          </Badge>
                        </div>
                        {match.datasets.length > 0 && (
                          <p className="text-muted-foreground mt-1">
                            Sources: {match.datasets.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheck}
                disabled={isChecking}
              >
                {isChecking ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                Re-check
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
              >
                <a 
                  href="https://search-uk-sanctions-list.service.gov.uk/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  GOV.UK
                </a>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
