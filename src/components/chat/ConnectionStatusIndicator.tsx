
import React from 'react';
import { Wifi, WifiOff, AlertTriangle, Loader2 } from 'lucide-react';

interface ConnectionStatusIndicatorProps {
  isConnected: boolean;
  loading: boolean;
  error: string | null;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function ConnectionStatusIndicator({ 
  isConnected, 
  loading, 
  error, 
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
    if (loading) return 'Connecting...';
    if (error) return 'Connection error';
    if (isConnected) return 'Connected';
    return 'Reconnecting...';
  };

  const getTooltipText = () => {
    if (loading) return 'Loading connection status';
    if (error) return `Connection error: ${error}`;
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
          loading ? 'text-blue-500' : 
          error ? 'text-red-500' : 
          isConnected ? 'text-green-500' : 'text-orange-500'
        }`}>
          {getStatusText()}
        </span>
      )}
    </div>
  );
}
