
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Shield } from 'lucide-react';
import { useSecureAuth } from '@/hooks/use-secure-auth';
import { TurnstileWidget } from './TurnstileWidget';
import { InputValidator } from '@/utils/input-validation';
import { toast } from 'sonner';

interface SecureLoginFormProps {
  onNeedsOTP: (email: string) => void;
}

export function SecureLoginForm({ onNeedsOTP }: SecureLoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const { secureSignIn } = useSecureAuth();

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!InputValidator.validateEmail(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (password) {
      const passwordValidation = InputValidator.validatePassword(password);
      if (!passwordValidation.isValid) {
        errors.password = passwordValidation.errors[0];
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the validation errors');
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
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setShowCaptcha(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = InputValidator.sanitizeInput(e.target.value);
    setEmail(value);
    if (validationErrors.email) {
      setValidationErrors(prev => ({ ...prev, email: '' }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value; // Don't sanitize passwords
    setPassword(value);
    if (validationErrors.password) {
      setValidationErrors(prev => ({ ...prev, password: '' }));
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
          Enter your credentials to access your account
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAABVNY-RtAZWQwtdF'}
                onVerify={setCaptchaToken}
                onError={() => {
                  toast.error('Captcha verification failed');
                  setCaptchaToken(null);
                }}
              />
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || (showCaptcha && !captchaToken)}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>

          <p className="text-sm text-gray-600 text-center">
            Leave password blank to receive a one-time code via email
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
