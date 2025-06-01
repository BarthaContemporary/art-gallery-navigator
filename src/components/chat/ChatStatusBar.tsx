
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, AlertCircle, CheckCircle } from 'lucide-react';

interface ChatStatusBarProps {
  connected: boolean;
  error: string | null;
  loading: boolean;
}

export function ChatStatusBar({ connected, error, loading }: ChatStatusBarProps) {
  if (loading) {
    return (
      <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-2 text-sm">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        <span className="text-blue-700">Connecting to chat...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-2 bg-red-50 border-b border-red-200 flex items-center gap-2 text-sm">
        <AlertCircle className="w-4 h-4 text-red-500" />
        <span className="text-red-700">{error}</span>
      </div>
    );
  }

  return (
    <div className={`px-3 py-2 border-b flex items-center gap-2 text-sm ${
      connected 
        ? 'bg-green-50 border-green-200' 
        : 'bg-yellow-50 border-yellow-200'
    }`}>
      {connected ? (
        <>
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-green-700">Connected</span>
          <Badge variant="secondary" className="ml-auto">
            <Wifi className="w-3 h-3 mr-1" />
            Online
          </Badge>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4 text-yellow-500" />
          <span className="text-yellow-700">Reconnecting...</span>
        </>
      )}
    </div>
  );
}
