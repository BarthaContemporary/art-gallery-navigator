import { useState } from 'react';
import { getEdgeFunctionUrl } from '@/lib/supabase-url';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Download, Mail, User, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const leadCaptureSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  mailingListOptIn: z.boolean().default(false),
});

type LeadCaptureFormData = z.infer<typeof leadCaptureSchema>;

interface LeadCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicationId: string;
  publicationTitle: string;
  defaultOptIn: boolean;
  consentText?: string;
}

export function LeadCaptureModal({
  open,
  onOpenChange,
  publicationId,
  publicationTitle,
  defaultOptIn,
  consentText = "I would like to receive updates and news via email",
}: LeadCaptureModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadReady, setDownloadReady] = useState(false);
  const [downloadToken, setDownloadToken] = useState<string | null>(null);

  const form = useForm<LeadCaptureFormData>({
    resolver: zodResolver(leadCaptureSchema),
    defaultValues: {
      name: '',
      email: '',
      mailingListOptIn: defaultOptIn,
    },
  });

  const handleSubmit = async (data: LeadCaptureFormData) => {
    setIsSubmitting(true);
    try {
      const { data: response, error } = await supabase.functions.invoke('publication-lead-capture', {
        body: {
          publicationId,
          name: data.name,
          email: data.email,
          mailingListOptIn: data.mailingListOptIn,
          userAgent: navigator.userAgent,
        },
      });

      if (error) throw error;

      if (response?.success && response?.downloadToken) {
        setDownloadToken(response.downloadToken);
        setDownloadReady(true);
        toast.success('Your download is ready!');
      } else {
        throw new Error(response?.error || 'Failed to process request');
      }
    } catch (error: any) {
      console.error('Lead capture error:', error);
      toast.error(error.message || 'Failed to process your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = () => {
    if (!downloadToken) return;
    
    const downloadUrl = `${getEdgeFunctionUrl('publication-download')}?token=${downloadToken}`;
    
    // Use anchor element with download attribute for direct download
    // The edge function now streams the PDF with Content-Disposition: attachment
    // so we don't need target="_blank" which can trigger popup blockers
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = ''; // Browser will use Content-Disposition filename
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Close modal after a short delay
    setTimeout(() => {
      onOpenChange(false);
      setDownloadReady(false);
      setDownloadToken(null);
      form.reset();
    }, 1000);
  };

  const handleClose = () => {
    onOpenChange(false);
    setDownloadReady(false);
    setDownloadToken(null);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download PDF
          </DialogTitle>
          <DialogDescription>
            {downloadReady 
              ? 'Your download is ready!'
              : `Enter your details to download "${publicationTitle}"`
            }
          </DialogDescription>
        </DialogHeader>

        {downloadReady ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center p-6 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
                  <Check className="h-6 w-6 text-green-600" />
                </div>
                <p className="font-medium text-green-700 dark:text-green-400">
                  Thank you!
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click below to start your download
                </p>
              </div>
            </div>
            <Button onClick={handleDownload} className="w-full" size="lg">
              <Download className="h-4 w-4 mr-2" />
              Download PDF Now
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="Your name" 
                          {...field} 
                          className="pl-10"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          type="email"
                          placeholder="your@email.com" 
                          {...field} 
                          className="pl-10"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mailingListOptIn"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="font-normal cursor-pointer">
                        {consentText}
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <p className="text-xs text-muted-foreground">
                By downloading, you agree to our privacy policy. Your information will be handled securely.
              </p>

              <div className="flex gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? 'Processing...' : 'Get Download Link'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
