
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Key, Lock, Eye, AlertTriangle } from 'lucide-react';
import { NotificationSettings } from '@/components/notifications/NotificationSettings';

export function SecuritySettings() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-green-600" />
        <h2 className="text-2xl font-bold">Security Settings</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Authentication Security
            </CardTitle>
            <CardDescription>
              Your authentication methods and security features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Password Protection</span>
              <Badge variant="default">Enabled</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Email Verification</span>
              <Badge variant="default">Required</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>CAPTCHA Protection</span>
              <Badge variant="default">Active</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Rate Limiting</span>
              <Badge variant="default">Active</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Data Protection
            </CardTitle>
            <CardDescription>
              How your data is protected and encrypted
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Chat Encryption</span>
              <Badge variant="default">AES-256-GCM</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Message Integrity</span>
              <Badge variant="default">HMAC-SHA256</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Row Level Security</span>
              <Badge variant="default">Enabled</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Input Validation</span>
              <Badge variant="default">Active</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Privacy Controls
            </CardTitle>
            <CardDescription>
              Control who can see your data and activities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Profile Visibility</span>
              <Badge variant="secondary">Private</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Activity Tracking</span>
              <Badge variant="secondary">Minimal</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Data Sharing</span>
              <Badge variant="secondary">Disabled</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Security Recommendations
            </CardTitle>
            <CardDescription>
              Actions to improve your account security
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm space-y-2">
              <p className="text-green-600">✓ Strong password policy enforced</p>
              <p className="text-green-600">✓ Email verification enabled</p>
              <p className="text-green-600">✓ All data access controlled</p>
              <p className="text-green-600">✓ Messages are end-to-end encrypted</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <NotificationSettings />
    </div>
  );
}
