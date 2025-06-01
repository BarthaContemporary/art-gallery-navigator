
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChatEncryption } from '@/lib/chat-encryption';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface ChatHealthMonitorProps {
  roomId?: string;
  userId?: string;
}

export function ChatHealthMonitor({ roomId, userId }: ChatHealthMonitorProps) {
  const [encryptionStatus, setEncryptionStatus] = useState<'unknown' | 'working' | 'failed'>('unknown');
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkEncryptionHealth = async () => {
    if (!roomId || !userId) return;

    setIsChecking(true);
    try {
      const key = await ChatEncryption.generateRoomKey(roomId, userId);
      const isWorking = await ChatEncryption.testKey(key);
      setEncryptionStatus(isWorking ? 'working' : 'failed');
      setLastCheck(new Date());
    } catch (error) {
      console.error('Encryption health check failed:', error);
      setEncryptionStatus('failed');
      setLastCheck(new Date());
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (roomId && userId) {
      checkEncryptionHealth();
    }
  }, [roomId, userId]);

  if (!roomId || !userId) {
    return null;
  }

  const getStatusIcon = () => {
    switch (encryptionStatus) {
      case 'working':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusText = () => {
    switch (encryptionStatus) {
      case 'working':
        return 'Encryption Active';
      case 'failed':
        return 'Encryption Failed';
      default:
        return 'Checking...';
    }
  };

  const getStatusColor = () => {
    switch (encryptionStatus) {
      case 'working':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Chat Security Status</CardTitle>
        <CardDescription className="text-xs">
          End-to-end encryption status for this conversation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={`flex items-center gap-2 p-2 rounded-md border ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>
        
        {lastCheck && (
          <p className="text-xs text-gray-500">
            Last checked: {lastCheck.toLocaleTimeString()}
          </p>
        )}
        
        <Button
          onClick={checkEncryptionHealth}
          disabled={isChecking}
          size="sm"
          variant="outline"
          className="w-full"
        >
          {isChecking ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Check Encryption
        </Button>
        
        {encryptionStatus === 'failed' && (
          <div className="p-2 bg-red-50 border border-red-200 rounded-md">
            <p className="text-xs text-red-700">
              Encryption is not working properly. Messages may be sent unencrypted as fallback.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
