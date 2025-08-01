/**
 * Phase 4: Image Performance Monitoring Hook
 * 
 * Monitors image loading performance and provides optimization insights.
 */

import { useCallback, useRef, useState, useEffect } from "react";
import { logger } from "@/lib/logger";

interface PerformanceMetrics {
  totalLoads: number;
  averageLoadTime: number;
  errorRate: number;
  cacheHitRate: number;
  slowLoads: number; // > 3 seconds
  sourceBreakdown: {
    supabase: number;
    cloudinary: number;
    fallback: number;
    placeholder: number;
  };
}

interface LoadEvent {
  url: string;
  source: string;
  tier: string;
  loadTime: number;
  success: boolean;
  fromCache: boolean;
  timestamp: number;
}

export function useImagePerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    totalLoads: 0,
    averageLoadTime: 0,
    errorRate: 0,
    cacheHitRate: 0,
    slowLoads: 0,
    sourceBreakdown: {
      supabase: 0,
      cloudinary: 0,
      fallback: 0,
      placeholder: 0
    }
  });

  const loadEventsRef = useRef<LoadEvent[]>([]);
  const loadStartTimesRef = useRef(new Map<string, number>());

  const trackLoadStart = useCallback((url: string) => {
    loadStartTimesRef.current.set(url, performance.now());
  }, []);

  const trackLoadComplete = useCallback((
    url: string,
    source: string,
    tier: string,
    success: boolean,
    fromCache: boolean = false
  ) => {
    const startTime = loadStartTimesRef.current.get(url);
    if (!startTime) return;

    const loadTime = performance.now() - startTime;
    loadStartTimesRef.current.delete(url);

    const event: LoadEvent = {
      url,
      source,
      tier,
      loadTime,
      success,
      fromCache,
      timestamp: Date.now()
    };

    loadEventsRef.current.push(event);

    // Keep only last 100 events to prevent memory leaks
    if (loadEventsRef.current.length > 100) {
      loadEventsRef.current = loadEventsRef.current.slice(-100);
    }

    // Update metrics
    updateMetrics();
  }, []);

  const updateMetrics = useCallback(() => {
    const events = loadEventsRef.current;
    if (events.length === 0) return;

    const totalLoads = events.length;
    const successfulLoads = events.filter(e => e.success);
    const averageLoadTime = successfulLoads.reduce((sum, e) => sum + e.loadTime, 0) / successfulLoads.length || 0;
    const errorRate = (events.length - successfulLoads.length) / events.length;
    const cacheHits = events.filter(e => e.fromCache).length;
    const cacheHitRate = cacheHits / events.length;
    const slowLoads = successfulLoads.filter(e => e.loadTime > 3000).length;

    const sourceBreakdown = events.reduce((acc, event) => {
      if (event.source in acc) {
        acc[event.source as keyof typeof acc]++;
      }
      return acc;
    }, {
      supabase: 0,
      cloudinary: 0,
      fallback: 0,
      placeholder: 0
    });

    setMetrics({
      totalLoads,
      averageLoadTime,
      errorRate,
      cacheHitRate,
      slowLoads,
      sourceBreakdown
    });

    // Log performance insights
    if (totalLoads % 10 === 0) { // Log every 10 loads
      logger.log('Image Performance Metrics:', {
        totalLoads,
        averageLoadTime: `${averageLoadTime.toFixed(2)}ms`,
        errorRate: `${(errorRate * 100).toFixed(1)}%`,
        cacheHitRate: `${(cacheHitRate * 100).toFixed(1)}%`,
        slowLoads,
        sourceBreakdown
      });
    }
  }, []);

  const getPerformanceInsights = useCallback(() => {
    const insights = [];

    if (metrics.errorRate > 0.1) {
      insights.push('High error rate detected - consider fallback strategy improvements');
    }

    if (metrics.averageLoadTime > 2000) {
      insights.push('Slow image loading - consider image optimization or CDN improvements');
    }

    if (metrics.cacheHitRate < 0.3) {
      insights.push('Low cache hit rate - consider improving cache strategy');
    }

    if (metrics.slowLoads > metrics.totalLoads * 0.2) {
      insights.push('Many slow loads detected - investigate image sizes and network conditions');
    }

    if (metrics.sourceBreakdown.placeholder > metrics.totalLoads * 0.1) {
      insights.push('High placeholder usage - check image processing pipeline');
    }

    return insights;
  }, [metrics]);

  const resetMetrics = useCallback(() => {
    loadEventsRef.current = [];
    loadStartTimesRef.current.clear();
    setMetrics({
      totalLoads: 0,
      averageLoadTime: 0,
      errorRate: 0,
      cacheHitRate: 0,
      slowLoads: 0,
      sourceBreakdown: {
        supabase: 0,
        cloudinary: 0,
        fallback: 0,
        placeholder: 0
      }
    });
  }, []);

  // Auto-cleanup old events with proper cleanup
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      loadEventsRef.current = loadEventsRef.current.filter(
        event => event.timestamp > fiveMinutesAgo
      );
    }, 60000); // Check every minute

    return () => {
      clearInterval(cleanup);
    };
  }, []);

  return {
    metrics,
    trackLoadStart,
    trackLoadComplete,
    getPerformanceInsights,
    resetMetrics
  };
}
