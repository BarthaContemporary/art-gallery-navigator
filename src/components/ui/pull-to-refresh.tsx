
import React from 'react';
import { RefreshCw, ArrowDown } from 'lucide-react';
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
  const indicatorHeight = isRefreshing ? 60 : Math.min(pullDistance, 60);

  return (
    <div ref={elementRef} className={cn('relative', className)}>
      {/* Pull indicator */}
      <div 
        className={cn(
          'absolute top-0 left-0 right-0 z-50 flex items-center justify-center transition-all duration-200',
          'bg-background/95 backdrop-blur-sm border-b',
          showIndicator ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          height: `${indicatorHeight}px`,
          transform: `translateY(-${showIndicator ? 0 : indicatorHeight}px)`
        }}
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isRefreshing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Refreshing...</span>
            </>
          ) : canRefresh ? (
            <>
              <RefreshCw className="h-4 w-4" />
              <span>Release to refresh</span>
            </>
          ) : (
            <>
              <ArrowDown 
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  progress > 0.5 ? 'rotate-180' : ''
                )} 
              />
              <span>Pull to refresh</span>
            </>
          )}
        </div>
      </div>

      {/* Content with padding for indicator */}
      <div 
        style={{
          paddingTop: showIndicator ? `${indicatorHeight}px` : '0px',
          transition: 'padding-top 200ms ease-in-out'
        }}
      >
        {children}
      </div>
    </div>
  );
}
