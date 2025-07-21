
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { UseFormReturn } from "react-hook-form";
import { ArtworkFormData } from "./types";
import { Book, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";

interface ProvenanceStoryFieldsProps {
  form: UseFormReturn<ArtworkFormData>;
  artists?: any[];
}

export function ProvenanceStoryFields({ form, artists = [] }: ProvenanceStoryFieldsProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generateAIDescription = async () => {
    setIsGenerating(true);
    try {
      const formValues = form.getValues();
      const artist = artists.find(a => a.id === formValues.artist_id);
      
      const { data, error } = await supabase.functions.invoke('generate-artwork-description', {
        body: {
          title: formValues.title,
          artist_name: artist?.full_name,
          medium_type: formValues.medium_type,
          year: formValues.year,
          materials: formValues.materials,
          dimensions: formValues.dimensions,
          story: formValues.story,
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(`Function error: ${error.message || 'Unknown error'}`);
      }

      if (!data?.description) {
        throw new Error('No description returned from AI service');
      }

      form.setValue('ai_description', data.description);
      toast({
        title: "AI Description Generated",
        description: "The AI description has been created successfully!",
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
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="provenance"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <Book className="h-4 w-4" />
              Provenance
            </FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder="Enter the artwork's provenance"
                className="min-h-[100px]"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="story"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <Book className="h-4 w-4" />
              Tell the story of this work
            </FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder="Share the story behind this artwork"
                className="min-h-[100px]"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="exhibition_history"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <Book className="h-4 w-4" />
              Exhibition History
            </FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder="List the exhibitions where this artwork has been shown"
                className="min-h-[100px]"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="ai_description"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Description
            </FormLabel>
            <FormControl>
              <div className="space-y-2">
                <Textarea
                  {...field}
                  placeholder="AI-generated description will appear here"
                  className="min-h-[100px]"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateAIDescription}
                  disabled={isGenerating || !form.watch('title')}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate AI Description
                    </>
                  )}
                </Button>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
