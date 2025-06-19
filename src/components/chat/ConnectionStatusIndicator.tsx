
import React from 'react';
import { Wifi, WifiOff, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

interface ConnectionStatusIndicatorProps {
  isConnected: boolean;
  loading: boolean;
  error: string | null;
  retryCount?: number;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function ConnectionStatusIndicator({ 
  isConnected, 
  loading, 
  error, 
  retryCount = 0,
  size = 'sm',
  showText = false 
}: ConnectionStatusIndicatorProps) {
  const iconSizeClass = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }[size];

  const getStatusIcon = () => {
    if (loading) {
      if (retryCount > 0) {
        return (
          <RefreshCw className={`${iconSizeClass} text-orange-500 animate-spin`} />
        );
      }
      return (
        <Loader2 className={`${iconSizeClass} text-blue-500 animate-spin`} />
      );
    }
    
    if (error) {
      return (
        <AlertTriangle className={`${iconSizeClass} text-red-500`} />
      );
    }
    
    if (isConnected) {
      return (
        <Wifi className={`${iconSizeClass} text-green-500`} />
      );
    } else {
      return (
        <WifiOff className={`${iconSizeClass} text-orange-500 animate-pulse`} />
      );
    }
  };

  const getStatusText = () => {
    if (loading) {
      return retryCount > 0 ? `Retrying... (${retryCount})` : 'Connecting...';
    }
    if (error) {
      return retryCount > 0 ? `Reconnecting... (${retryCount})` : 'Connection error';
    }
    if (isConnected) return 'Connected';
    return 'Reconnecting...';
  };

  const getTooltipText = () => {
    if (loading) {
      return retryCount > 0 
        ? `Retrying connection (attempt ${retryCount})`
        : 'Loading connection status';
    }
    if (error) {
      return retryCount > 0 
        ? `Reconnecting after error (attempt ${retryCount}): ${error}`
        : `Connection error: ${error}`;
    }
    if (isConnected) return 'Connected to real-time updates';
    return 'Reconnecting to real-time updates...';
  };

  return (
    <div 
      className="flex items-center gap-1" 
      title={getTooltipText()}
    >
      {getStatusIcon()}
      {showText && (
        <span className={`text-xs ${
          loading ? (retryCount > 0 ? 'text-orange-500' : 'text-blue-500') : 
          error ? 'text-red-500' : 
          isConnected ? 'text-green-500' : 'text-orange-500'
        }`}>
          {getStatusText()}
        </span>
      )}
    </div>
  );
}
