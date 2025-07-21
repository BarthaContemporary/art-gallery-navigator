import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

interface AIDescriptionHistoryProps {
  artworkId: string;
}

interface AIDescriptionHistoryEntry {
  id: string;
  description: string;
  keywords_used: string | null;
  generated_at: string;
  model_used: string;
}

export function AIDescriptionHistory({ artworkId }: AIDescriptionHistoryProps) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['ai-description-history', artworkId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_description_history')
        .select('*')
        .eq('artwork_id', artworkId)
        .order('generated_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as AIDescriptionHistoryEntry[];
    },
  });

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">
        Loading history...
      </div>
    );
  }

  if (!history || history.length === 0) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Generation History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {history.map((entry, index) => (
          <div
            key={entry.id}
            className="border rounded-lg p-3 text-sm space-y-2"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {format(new Date(entry.generated_at), 'MMM d, yyyy at h:mm a')}
              </span>
              <span>{entry.model_used}</span>
            </div>
            
            {entry.keywords_used && (
              <div className="text-xs">
                <span className="font-medium">Keywords used:</span>{' '}
                <span className="text-muted-foreground">{entry.keywords_used}</span>
              </div>
            )}
            
            <div className="text-xs leading-relaxed text-muted-foreground">
              {entry.description}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}