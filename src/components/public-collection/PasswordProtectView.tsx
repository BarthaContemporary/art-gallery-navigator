import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ShieldAlert } from 'lucide-react';

interface PasswordProtectViewProps {
  websiteSlug: string;
  onVerified: () => void;
}

export function PasswordProtectView({ websiteSlug, onVerified }: PasswordProtectViewProps) {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('hash-collection-password', {
        body: {
          slug: websiteSlug,
          attemptedPassword: password,
        },
      });

      if (invokeError) {
        console.error('Supabase function invokeError:', invokeError);
        setError(`Function Error: ${invokeError.message}`);
      } else if (data.error) {
        console.log('Function returned data error:', data.error);
        setError(data.error);
      } else if (data.verified) {
        onVerified();
      } else {
        console.log('Verification failed, no specific error in data.');
        setError('Invalid password. Please try again.');
      }
    } catch (err: any) {
      console.error('Password verification submit catch error:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Password Protected</CardTitle>
          <CardDescription className="text-center">
            This collection website is password protected. Please enter the password to view its content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
              className="text-base"
              aria-label="Password"
            />
            {error && (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={isLoading || !password}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Unlock'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
