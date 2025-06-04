
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
  const elementRef = useRef<HTMLElement | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled || state.isRefreshing) return;
    
    // Only trigger if we're at the top of the page
    if (window.scrollY > 0) return;
    
    startY.current = e.touches[0].clientY;
    setState(prev => ({ ...prev, isPulling: true }));
  }, [enabled, state.isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || state.isRefreshing || !state.isPulling) return;
    
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    if (diff > 0 && window.scrollY === 0) {
      e.preventDefault(); // Prevent default scroll behavior
      
      const pullDistance = Math.min(diff / resistance, threshold * 1.5);
      const canRefresh = pullDistance >= threshold;
      
      setState(prev => ({
        ...prev,
        pullDistance,
        canRefresh
      }));
    }
  }, [enabled, state.isRefreshing, state.isPulling, threshold, resistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!enabled || state.isRefreshing || !state.isPulling) return;
    
    setState(prev => ({ ...prev, isPulling: false }));
    
    if (state.canRefresh) {
      setState(prev => ({ ...prev, isRefreshing: true, pullDistance: threshold }));
      
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
      setState(prev => ({ ...prev, pullDistance: 0, canRefresh: false }));
    }
  }, [enabled, state.isRefreshing, state.isPulling, state.canRefresh, onRefresh, threshold]);

  useEffect(() => {
    const element = elementRef.current || document.body;
    
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });
    
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
