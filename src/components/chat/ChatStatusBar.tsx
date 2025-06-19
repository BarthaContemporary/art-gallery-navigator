
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react';

interface ChatStatusBarProps {
  connected: boolean;
  error?: string | null;
  loading?: boolean;
}

export function ChatStatusBar({ connected, error, loading }: ChatStatusBarProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Connecting...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Badge variant="destructive" className="text-xs">
        <AlertCircle className="h-3 w-3 mr-1" />
        Connection Error
      </Badge>
    );
  }

  return (
    <Badge variant={connected ? "default" : "secondary"} className="text-xs">
      {connected ? (
        <>
          <Wifi className="h-3 w-3 mr-1" />
          Connected
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3 mr-1" />
          Disconnected
        </>
      )}
    </Badge>
  );
}
