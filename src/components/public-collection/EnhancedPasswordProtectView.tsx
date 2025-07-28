
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, AlertTriangle, Timer } from "lucide-react";
import { collectionPasswordSecurity } from "@/utils/collection-password-security";

interface EnhancedPasswordProtectViewProps {
  onPasswordVerified: () => void;
  collectionName?: string;
  hashedPassword: string;
  slug: string;
}

export function EnhancedPasswordProtectView({
  onPasswordVerified,
  collectionName,
  hashedPassword,
  slug
}: EnhancedPasswordProtectViewProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [blockedTimeRemaining, setBlockedTimeRemaining] = useState(0);

  // Get client IP (in a real app, this would come from the server)
  const getClientIP = () => {
    // This is a simplified version - in production, you'd get this from the server
    return 'client-ip';
  };

  useEffect(() => {
    const checkBlockStatus = () => {
      const clientIP = getClientIP();
      const blocked = collectionPasswordSecurity.getBlockedTimeRemaining(slug, clientIP);
      setBlockedTimeRemaining(blocked);
      
      if (blocked === 0) {
        const remaining = collectionPasswordSecurity.getRemainingAttempts(slug, clientIP);
        setRemainingAttempts(remaining);
      }
    };

    checkBlockStatus();
    const interval = setInterval(checkBlockStatus, 1000);
    return () => clearInterval(interval);
  }, [slug]);

  const formatTimeRemaining = (milliseconds: number): string => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (blockedTimeRemaining > 0) {
      setError(`Access blocked. Try again in ${formatTimeRemaining(blockedTimeRemaining)}.`);
      return;
    }

    if (!password.trim()) {
      setError("Please enter a password");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const clientIP = getClientIP();
      const result = await collectionPasswordSecurity.verifyPassword(
        slug,
        password,
        hashedPassword,
        clientIP
      );

      if (result.success) {
        onPasswordVerified();
      } else {
        setError(result.message || "Incorrect password");
        setRemainingAttempts(result.remainingAttempts || null);
        
        if (result.message?.includes("Too many failed attempts")) {
          setBlockedTimeRemaining(
            collectionPasswordSecurity.getBlockedTimeRemaining(slug, clientIP)
          );
        }
      }
    } catch (error) {
      setError("An error occurred. Please try again.");
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
          {blockedTimeRemaining > 0 ? (
            <Alert variant="destructive">
              <Timer className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>Access temporarily blocked</span>
                  <span className="font-mono font-bold">
                    {formatTimeRemaining(blockedTimeRemaining)}
                  </span>
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
                  disabled={isLoading || blockedTimeRemaining > 0}
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
                disabled={isLoading || blockedTimeRemaining > 0}
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
