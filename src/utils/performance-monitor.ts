/**
 * Performance monitoring and optimization utilities
 */
import React from 'react';

export interface PerformanceMetrics {
  component: string;
  renderTime: number;
  timestamp: number;
}

export class PerformanceMonitor {
  private static metrics: PerformanceMetrics[] = [];
  private static isProduction = process.env.NODE_ENV === 'production';

  // Remove console.log statements in production
  static logRender(component: string, renderTime: number) {
    if (this.isProduction) return;
    
    this.metrics.push({
      component,
      renderTime,
      timestamp: Date.now()
    });

    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  }

  // Get performance insights
  static getInsights() {
    if (this.isProduction) return null;

    const componentStats = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.component]) {
        acc[metric.component] = {
          count: 0,
          totalTime: 0,
          maxTime: 0,
          avgTime: 0
        };
      }

      acc[metric.component].count++;
      acc[metric.component].totalTime += metric.renderTime;
      acc[metric.component].maxTime = Math.max(acc[metric.component].maxTime, metric.renderTime);
      acc[metric.component].avgTime = acc[metric.component].totalTime / acc[metric.component].count;

      return acc;
    }, {} as Record<string, any>);

    return componentStats;
  }

  // Clear metrics
  static clear() {
    this.metrics = [];
  }
}

// Higher-order component for performance monitoring
export function withPerformanceMonitor<T extends Record<string, any>>(
  Component: React.ComponentType<T>,
  componentName: string
) {
  return React.memo((props: T) => {
    const startTime = performance.now();
    
    React.useEffect(() => {
      const endTime = performance.now();
      PerformanceMonitor.logRender(componentName, endTime - startTime);
    });

    return React.createElement(Component, props);
  });
}

// Custom hook for tracking component render performance
export function usePerformanceTracker(componentName: string) {
  const startTime = React.useRef(performance.now());

  React.useEffect(() => {
    const endTime = performance.now();
    PerformanceMonitor.logRender(componentName, endTime - startTime.current);
    startTime.current = performance.now();
  });
}

// Memory usage tracking
export class MemoryMonitor {
  static checkMemoryUsage() {
    const isProduction = process.env.NODE_ENV === 'production';
    const perfMemory = (performance as any).memory;
    
    if (!perfMemory || isProduction) return null;

    return {
      used: Math.round(perfMemory.usedJSHeapSize / 1048576), // MB
      total: Math.round(perfMemory.totalJSHeapSize / 1048576), // MB
      limit: Math.round(perfMemory.jsHeapSizeLimit / 1048576), // MB
      usage: Math.round((perfMemory.usedJSHeapSize / perfMemory.jsHeapSizeLimit) * 100) // %
    };
  }

  static isMemoryPressure(): boolean {
    const memory = this.checkMemoryUsage();
    return memory ? memory.usage > 80 : false;
  }
}

// Image loading optimization
export class ImageOptimizer {
  private static loadedImages = new Set<string>();
  private static loadingImages = new Map<string, Promise<boolean>>();

  static async preloadImage(src: string): Promise<boolean> {
    if (this.loadedImages.has(src)) {
      return true;
    }

    if (this.loadingImages.has(src)) {
      return this.loadingImages.get(src)!;
    }

    const promise = new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.loadedImages.add(src);
        this.loadingImages.delete(src);
        resolve(true);
      };
      img.onerror = () => {
        this.loadingImages.delete(src);
        resolve(false);
      };
      img.src = src;
    });

    this.loadingImages.set(src, promise);
    return promise;
  }

  static isImageLoaded(src: string): boolean {
    return this.loadedImages.has(src);
  }

  static clearCache() {
    this.loadedImages.clear();
    this.loadingImages.clear();
  }
}

// Network status monitoring
export class NetworkMonitor {
  static isOnline(): boolean {
    return navigator.onLine;
  }

  static getConnectionType(): string {
    const connection = (navigator as any).connection;
    return connection?.effectiveType || 'unknown';
  }

  static isSlowConnection(): boolean {
    const connection = (navigator as any).connection;
    const slowTypes = ['slow-2g', '2g'];
    return slowTypes.includes(connection?.effectiveType);
  }
}

export default PerformanceMonitor;
