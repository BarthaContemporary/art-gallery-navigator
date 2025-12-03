import React from 'react';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AutosaveIndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error';
  className?: string;
}

export function AutosaveIndicator({ status, className }: AutosaveIndicatorProps) {
  const getStatusInfo = () => {
    switch (status) {
      case 'saving':
        return {
          icon: Loader2,
          text: 'Saving...',
          className: 'text-muted-foreground',
          iconClassName: 'animate-spin'
        };
      case 'saved':
        return {
          icon: Check,
          text: 'Saved',
          className: 'text-green-600',
          iconClassName: ''
        };
      case 'error':
        return {
          icon: AlertCircle,
          text: 'Save failed',
          className: 'text-destructive',
          iconClassName: ''
        };
      default:
        return null;
    }
  };

  const statusInfo = getStatusInfo();

  if (!statusInfo) return null;

  const { icon: Icon, text, className: statusClassName, iconClassName } = statusInfo;

  return (
    <div className={cn(
      'flex items-center gap-2 text-sm px-3 py-1.5 border',
      'bg-background/80 backdrop-blur-sm transition-all duration-200',
      statusClassName, 
      className
    )}>
      <Icon className={cn('h-4 w-4', iconClassName)} />
      <span className="font-medium">{text}</span>
    </div>
  );
}