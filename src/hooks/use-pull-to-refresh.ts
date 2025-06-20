
import { useState, useEffect, useCallback, useRef } from 'react';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  resistance?: number;
  enabled?: boolean;
}

interface PullToRefreshState {
  isPulling: boolean;
  isRefreshing: boolean;
  pullDistance: number;
  canRefresh: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  resistance = 2.5,
  enabled = true
}: PullToRefreshOptions) {
  const [state, setState] = useState<PullToRefreshState>({
    isPulling: false,
    isRefreshing: false,
    pullDistance: 0,
    canRefresh: false
  });

  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const isValidPull = useRef<boolean>(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled || state.isRefreshing) return;
    
    // Only start tracking if we're at the very top of the page
    if (window.scrollY > 0) return;
    
    startY.current = e.touches[0].clientY;
    isValidPull.current = false;
  }, [enabled, state.isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || state.isRefreshing) return;
    
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    // Only engage pull-to-refresh if:
    // 1. We're pulling down (diff > 0)
    // 2. We're at the top of the page (scrollY === 0)
    // 3. The pull distance is significant enough (> 10px to avoid accidental triggers)
    if (diff > 10 && window.scrollY === 0) {
      isValidPull.current = true;
      
      // Only prevent default if we're in a valid pull state
      if (isValidPull.current) {
        e.preventDefault();
        
        const pullDistance = Math.min(diff / resistance, threshold * 1.5);
        const canRefresh = pullDistance >= threshold;
        
        setState(prev => ({
          ...prev,
          isPulling: true,
          pullDistance,
          canRefresh
        }));
      }
    } else if (diff <= 0) {
      // Reset if user starts scrolling up
      isValidPull.current = false;
      setState(prev => ({
        ...prev,
        isPulling: false,
        pullDistance: 0,
        canRefresh: false
      }));
    }
  }, [enabled, state.isRefreshing, threshold, resistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!enabled || state.isRefreshing) return;
    
    if (isValidPull.current && state.canRefresh) {
      setState(prev => ({ 
        ...prev, 
        isRefreshing: true, 
        isPulling: false,
        pullDistance: threshold 
      }));
      
      try {
        await onRefresh();
      } catch (error) {
        console.error('Pull to refresh error:', error);
      } finally {
        setState(prev => ({
          ...prev,
          isRefreshing: false,
          pullDistance: 0,
          canRefresh: false
        }));
      }
    } else {
      setState(prev => ({ 
        ...prev, 
        isPulling: false,
        pullDistance: 0, 
        canRefresh: false 
      }));
    }
    
    isValidPull.current = false;
  }, [enabled, state.isRefreshing, state.canRefresh, onRefresh, threshold]);

  useEffect(() => {
    const element = elementRef.current || document.body;
    
    // Use passive: false only for touchmove to allow preventDefault when needed
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    ...state,
    elementRef,
    progress: Math.min(state.pullDistance / threshold, 1)
  };
}
