import React, { useState, useEffect } from 'react';
import { Artwork } from '@/hooks/use-artworks';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useArtists } from '@/hooks/useArtists';
import { AIDescriptionHistory } from './AIDescriptionHistory';
interface ArtworkAIDescriptionTabProps {
  artwork: Artwork;
}
export function ArtworkAIDescriptionTab({
  artwork
}: ArtworkAIDescriptionTabProps) {
  const {
    toast
  } = useToast();
  const {
    data: artists
  } = useArtists();
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentDescription, setCurrentDescription] = useState(artwork.ai_description);

  // Set up real-time subscription to listen for updates to this artwork
  useEffect(() => {
    const channel = supabase.channel('artwork-ai-description-updates').on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'artworks',
      filter: `id=eq.${artwork.id}`
    }, payload => {
      if (payload.new && 'ai_description' in payload.new) {
        setCurrentDescription(payload.new.ai_description);
      }
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [artwork.id]);

  // Update local state when artwork prop changes
  useEffect(() => {
    setCurrentDescription(artwork.ai_description);
  }, [artwork.ai_description]);
  const generateAIDescription = async () => {
    setIsGenerating(true);
    try {
      const artist = artists?.find(a => a.id === artwork.artist_id);
      const requestData = {
        artwork_id: artwork.id,
        title: artwork.title,
        artist_name: artist?.full_name,
        medium_type: artwork.medium_type,
        year: artwork.year,
        materials: artwork.materials,
        dimensions: artwork.dimensions,
        story: artwork.story,
        additional_keywords: artwork.additional_keywords
      };
      const {
        data,
        error
      } = await supabase.functions.invoke('generate-artwork-description', {
        body: requestData
      });
      if (error) {
        throw new Error(`Function error: ${error.message || 'Unknown error'}`);
      }
      if (!data?.description) {
        throw new Error('No description returned from AI service');
      }

      // Update the artwork with new AI description
      const {
        error: updateError
      } = await supabase.from('artworks').update({
        ai_description: data.description
      }).eq('id', artwork.id);
      if (updateError) {
        throw new Error('Failed to save AI description');
      }

      // Update local state immediately for instant feedback
      setCurrentDescription(data.description);
      toast({
        title: "AI Description Generated",
        description: "The AI description has been created successfully!"
      });
    } catch (error: any) {
      console.error('Error generating AI description:', error);
      let errorMessage = "Failed to generate AI description. Please try again.";
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        errorMessage = "OpenAI API rate limit exceeded. Please try again later.";
      } else if (error.message?.includes('OPENAI_API_KEY')) {
        errorMessage = "OpenAI API key not configured. Please contact admin.";
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };
  return <div className="space-y-6">
      

      

      <AIDescriptionHistory artworkId={artwork.id} />
    </div>;
}