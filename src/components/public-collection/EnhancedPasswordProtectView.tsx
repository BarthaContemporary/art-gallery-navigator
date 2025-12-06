
import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, AlertTriangle, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface EnhancedPasswordProtectViewProps {
  onPasswordVerified: () => void;
  collectionName?: string;
  slug: string;
}

export function EnhancedPasswordProtectView({
  onPasswordVerified,
  collectionName,
  slug
}: EnhancedPasswordProtectViewProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);

  const formatTimeRemaining = (milliseconds: number): string => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isBlocked) {
      setError("Access blocked. Please wait before trying again.");
      return;
    }

    if (!password.trim()) {
      setError("Please enter a password");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Use the secure server-side password verification edge function
      const { data, error: invokeError } = await supabase.functions.invoke('verify-collection-password', {
        body: {
          slug,
          password,
        },
      });

      if (invokeError) {
        console.error('Password verification error:', invokeError);
        setError('Verification failed. Please try again.');
        return;
      }

      if (data?.success) {
        onPasswordVerified();
      } else if (data?.blocked) {
        setIsBlocked(true);
        setError('Too many failed attempts. Please try again later.');
        setRemainingAttempts(0);
        
        // Unblock after 15 minutes
        setTimeout(() => setIsBlocked(false), 15 * 60 * 1000);
      } else {
        setError(data?.error || 'Incorrect password');
        if (typeof data?.remainingAttempts === 'number') {
          setRemainingAttempts(data.remainingAttempts);
        }
      }
    } catch (error) {
      console.error('Password verification error:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Protected Collection</CardTitle>
          <CardDescription>
            {collectionName ? (
              <>This collection "<strong>{collectionName}</strong>" is password protected</>
            ) : (
              "This collection is password protected"
            )}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {isBlocked ? (
            <Alert variant="destructive">
              <Timer className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>Access temporarily blocked</span>
                </div>
                <div className="text-sm mt-1">
                  Too many failed attempts. Please wait before trying again.
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  type="password"
                  placeholder="Enter collection password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading || isBlocked}
                  autoFocus
                  autoComplete="current-password"
                  spellCheck="false"
                  autoCapitalize="off"
                />
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {remainingAttempts !== null && remainingAttempts < 5 && remainingAttempts > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining before temporary lockout
                  </AlertDescription>
                </Alert>
              )}
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || isBlocked}
              >
                {isLoading ? "Verifying..." : "Access Collection"}
              </Button>
            </form>
          )}
          
          <div className="text-center text-sm text-muted-foreground">
            Please contact the collection owner if you need access
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
