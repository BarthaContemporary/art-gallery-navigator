import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, User, MapPin, FileText, ExternalLink, Instagram, Linkedin, Search } from "lucide-react";
import { EmailEnrichmentResult } from "@/hooks/crm/use-email-enrichment";

interface EnrichmentResultsPanelProps {
  result: EmailEnrichmentResult;
  onAddField: (field: string, value: string) => void;
  currentValues: {
    full_name?: string;
    notes?: string;
    city?: string;
    instagram_handle?: string;
    linkedin_handle?: string;
  };
}

export function EnrichmentResultsPanel({ 
  result, 
  onAddField,
  currentValues 
}: EnrichmentResultsPanelProps) {
  if (result.source === 'none') {
    return null;
  }

  const sourceLabel = result.source === 'combined' 
    ? 'Gravatar + Hunter.io' 
    : result.source === 'hunter' 
    ? 'Hunter.io' 
    : 'Gravatar';

  const fields = [
    {
      key: 'full_name',
      label: 'Name',
      value: result.fullName,
      icon: User,
      currentValue: currentValues.full_name,
    },
    {
      key: 'notes',
      label: 'Bio',
      value: result.bio,
      icon: FileText,
      currentValue: currentValues.notes,
      append: true,
    },
    {
      key: 'city',
      label: 'Location',
      value: result.location,
      icon: MapPin,
      currentValue: currentValues.city,
    },
    {
      key: 'instagram_handle',
      label: 'Instagram',
      value: result.instagram_handle,
      icon: Instagram,
      currentValue: currentValues.instagram_handle,
    },
    {
      key: 'linkedin_handle',
      label: 'LinkedIn',
      value: result.linkedin_handle || (result.linkedin_url ? 'Profile found' : undefined),
      icon: Linkedin,
      currentValue: currentValues.linkedin_handle,
      linkedinUrl: result.linkedin_url,
    },
  ].filter(f => f.value);

  const hasInstagramSearch = !result.instagram_handle && result.instagram_search_url;

  if (fields.length === 0 && !result.profileUrl && !hasInstagramSearch) {
    return null;
  }

  return (
    <Card className="col-span-2 bg-muted/50 border-dashed">
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-xs font-medium flex items-center justify-between">
          <span>Profile found via {sourceLabel}</span>
          {result.profileUrl && (
            <a 
              href={result.profileUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-3 space-y-2">
        {fields.map((field) => (
          <div 
            key={field.key} 
            className="flex items-center justify-between gap-2 text-sm"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <field.icon className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="truncate">{field.value}</span>
              {field.linkedinUrl && (
                <a 
                  href={field.linkedinUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs shrink-0"
              onClick={() => onAddField(field.key, field.linkedinUrl || field.value!)}
              disabled={field.currentValue === field.value}
            >
              <Plus className="h-3 w-3 mr-1" />
              {field.append ? 'Append' : 'Use'}
            </Button>
          </div>
        ))}
        
        {/* Instagram Search Link (when no handle found) */}
        {hasInstagramSearch && (
          <div className="flex items-center justify-between gap-2 text-sm border-t pt-2 mt-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Instagram className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground text-xs">No Instagram found</span>
            </div>
            <a 
              href={result.instagram_search_url} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs shrink-0"
              >
                <Search className="h-3 w-3 mr-1" />
                Search
              </Button>
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
