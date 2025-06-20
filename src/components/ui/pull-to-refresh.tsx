
import React from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void> | void;
  enabled?: boolean;
  className?: string;
}

export function PullToRefresh({ 
  children, 
  onRefresh, 
  enabled = true, 
  className 
}: PullToRefreshProps) {
  const { 
    isPulling, 
    isRefreshing, 
    pullDistance, 
    canRefresh, 
    progress, 
    elementRef 
  } = usePullToRefresh({
    onRefresh,
    enabled
  });

  const showIndicator = isPulling || isRefreshing;
  const indicatorHeight = isRefreshing ? 40 : Math.min(pullDistance, 40);

  return (
    <div ref={elementRef} className={cn('relative', className)}>
      {/* Pull indicator - positioned fixed to avoid layout shifts */}
      {showIndicator && (
        <div 
          className={cn(
            'fixed top-0 left-0 right-0 z-50 flex items-center justify-center transition-all duration-200',
            'bg-background/95 backdrop-blur-sm border-b border-border/20',
            'transform-gpu' // Use GPU acceleration for smoother animations
          )}
          style={{
            height: `${indicatorHeight}px`,
            transform: `translateY(${showIndicator ? 0 : -indicatorHeight}px)`
          }}
        >
          <RefreshCw 
            className={cn(
              'h-5 w-5 text-muted-foreground transition-transform duration-200',
              isRefreshing ? 'animate-spin' : '',
              canRefresh ? 'rotate-180' : ''
            )} 
          />
        </div>
      )}

      {/* Content - no padding manipulation to avoid scroll jumps */}
      <div className="relative">
        {children}
      </div>
    </div>
  );
}
