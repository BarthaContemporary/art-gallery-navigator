
export class PerformanceMonitor {
  private static marks = new Map<string, number>();
  
  static mark(label: string) {
    this.marks.set(`${label}-start`, performance.now());
  }

  static measure(label: string) {
    const startTime = this.marks.get(`${label}-start`);
    if (startTime) {
      const duration = performance.now() - startTime;
      console.log(`Performance: ${label}`, {
        duration: `${duration.toFixed(2)}ms`,
        timestamp: new Date().toISOString()
      });
      this.marks.delete(`${label}-start`);
      return duration;
    }
    return 0;
  }

  static async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.mark(label);
    const result = await fn();
    this.measure(label);
    return result;
  }

  static measureSync<T>(label: string, fn: () => T): T {
    this.mark(label);
    const result = fn();
    this.measure(label);
    return result;
  }

  static logRenderCount(componentName: string) {
    const key = `render-${componentName}`;
    const count = (this.marks.get(key) || 0) + 1;
    this.marks.set(key, count);
    
    if (count % 10 === 0) {
      console.warn(`${componentName} has rendered ${count} times`);
    }
  }
}
