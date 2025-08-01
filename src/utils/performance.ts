
export class PerformanceMonitor {
  private static markStart(label: string) {
    performance.mark(`${label}-start`);
  }

  private static markEnd(label: string) {
    performance.mark(`${label}-end`);
    performance.measure(label, `${label}-start`, `${label}-end`);
    
    const measurements = performance.getEntriesByName(label);
    const lastMeasurement = measurements[measurements.length - 1];
    
    // Silent in production - performance logs only in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Performance: ${label}`, {
        duration: lastMeasurement.duration,
        timestamp: new Date().toISOString()
      });
    }

    // Clean up marks and measures to prevent memory leaks
    performance.clearMarks(`${label}-start`);
    performance.clearMarks(`${label}-end`);
    performance.clearMeasures(label);
  }

  static measure<T>(label: string, fn: () => T): T {
    this.markStart(label);
    const result = fn();
    this.markEnd(label);
    return result;
  }

  static async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.markStart(label);
    const result = await fn();
    this.markEnd(label);
    return result;
  }
}
