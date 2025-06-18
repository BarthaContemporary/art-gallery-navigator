
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Shield, AlertTriangle } from 'lucide-react';
import { useEnhancedSecureAuth } from '@/hooks/use-enhanced-secure-auth';
import { TurnstileWidget } from './TurnstileWidget';
import { EnhancedInputValidator } from '@/utils/enhanced-input-validation';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SecurityEnhancedLoginFormProps {
  onNeedsOTP: (email: string) => void;
}

export function SecurityEnhancedLoginForm({ onNeedsOTP }: SecurityEnhancedLoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [securityWarnings, setSecurityWarnings] = useState<string[]>([]);
  const [attemptCount, setAttemptCount] = useState(0);

  const { secureSignIn } = useEnhancedSecureAuth();

  const validateForm = () => {
    const errors: Record<string, string> = {};
    const warnings: string[] = [];

    if (!EnhancedInputValidator.validateEmail(email)) {
      errors.email = 'Please enter a valid email address';
    } else {
      // Check for common typos in email domains
      const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
      const emailDomain = email.split('@')[1]?.toLowerCase();
      if (emailDomain && !commonDomains.includes(emailDomain)) {
        const suggestions = commonDomains.filter(domain => 
          domain.includes(emailDomain.substring(0, 3))
        );
        if (suggestions.length > 0) {
          warnings.push(`Did you mean ${suggestions[0]}?`);
        }
      }
    }

    if (password) {
      const passwordValidation = EnhancedInputValidator.validatePassword(password);
      if (!passwordValidation.isValid) {
        errors.password = passwordValidation.errors[0];
      }

      // Check for weak password patterns
      if (password.toLowerCase().includes(email.split('@')[0]?.toLowerCase() || '')) {
        warnings.push('Your password contains part of your email address');
      }
    }

    setValidationErrors(errors);
    setSecurityWarnings(warnings);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setAttemptCount(prev => prev + 1);

    if (!validateForm()) {
      toast.error('Please fix the validation errors');
      return;
    }

    // Show captcha after 2 failed attempts
    if (attemptCount >= 2 && !captchaToken) {
      setShowCaptcha(true);
      toast.error('Please complete the security verification');
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await secureSignIn(email, password || undefined, captchaToken || undefined);
      
      if (result.needsOTP) {
        onNeedsOTP(email);
      } else if ('error' in result && result.error) {
        if (result.error.includes('captcha') || result.error.includes('security')) {
          setShowCaptcha(true);
          toast.error('Please complete the security verification');
        } else if (result.error.includes('rate limit')) {
          toast.error('Too many attempts. Please wait before trying again.');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setShowCaptcha(true);
      toast.error('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = EnhancedInputValidator.sanitizeInput(e.target.value);
    setEmail(value);
    if (validationErrors.email) {
      setValidationErrors(prev => ({ ...prev, email: '' }));
    }
    if (securityWarnings.length > 0) {
      setSecurityWarnings([]);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    if (validationErrors.password) {
      setValidationErrors(prev => ({ ...prev, password: '' }));
    }
    if (securityWarnings.length > 0) {
      setSecurityWarnings([]);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
          <Shield className="h-6 w-6" />
          Secure Sign In
        </CardTitle>
        <CardDescription className="text-center">
          Enter your credentials to access your account securely
        </CardDescription>
      </CardHeader>
      <CardContent>
        {securityWarnings.length > 0 && (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {securityWarnings.map((warning, index) => (
                <div key={index}>{warning}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={handleEmailChange}
              required
              className={validationErrors.email ? 'border-red-500' : ''}
              autoComplete="email"
              maxLength={254} // RFC 5321 limit
            />
            {validationErrors.email && (
              <p className="text-sm text-red-500">{validationErrors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password (optional)</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password or leave blank for OTP"
                value={password}
                onChange={handlePasswordChange}
                className={validationErrors.password ? 'border-red-500' : ''}
                autoComplete="current-password"
                maxLength={128} // Prevent extremely long passwords
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {validationErrors.password && (
              <p className="text-sm text-red-500">{validationErrors.password}</p>
            )}
          </div>

          {showCaptcha && (
            <div className="space-y-2">
              <Label>Security Verification</Label>
              <TurnstileWidget
                onVerify={setCaptchaToken}
              />
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || (showCaptcha && !captchaToken)}
          >
            {isLoading ? 'Signing in...' : 'Sign In Securely'}
          </Button>

          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600">
              Leave password blank to receive a one-time code via email
            </p>
            {attemptCount > 0 && (
              <p className="text-xs text-gray-500">
                Attempt {attemptCount}/5 - Enhanced security after 2 attempts
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
