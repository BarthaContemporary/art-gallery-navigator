/**
 * Performance monitoring utility for measuring and optimizing operations
 */

interface PerformanceMeasure {
  operation: string;
  duration: number;
  timestamp: number;
}

// Track performance of operations
const measurements: PerformanceMeasure[] = [];

// Maximum entries to keep in history
const MAX_HISTORY = 100;

// Define slow operation threshold (in ms)
const SLOW_OPERATION_THRESHOLD = 200;

/**
 * Measure the execution time of a function
 * @param name Name of the operation to measure
 * @param fn Function to execute and measure
 */
export async function measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const end = performance.now();
    const duration = end - start;
    
    // Record this measurement
    measurements.push({
      operation: name,
      duration,
      timestamp: Date.now(),
    });
    
    // Trim history if needed
    if (measurements.length > MAX_HISTORY) {
      measurements.shift();
    }
    
    // Log slow operations to console
    if (duration > SLOW_OPERATION_THRESHOLD) {
      console.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
    }
  }
}

/**
 * Measure a synchronous function execution time
 */
export function measureSync<T>(name: string, fn: () => T): T {
  const start = performance.now();
  try {
    return fn();
  } finally {
    const end = performance.now();
    const duration = end - start;
    
    // Record this measurement
    measurements.push({
      operation: name,
      duration,
      timestamp: Date.now(),
    });
    
    // Trim history if needed
    if (measurements.length > MAX_HISTORY) {
      measurements.shift();
    }
    
    // Log slow operations to console
    if (duration > SLOW_OPERATION_THRESHOLD) {
      console.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
    }
  }
}

/**
 * Get performance statistics
 */
export function getPerformanceStats() {
  // Calculate average duration per operation type
  const operationStats: Record<string, { count: number; totalTime: number; average: number }> = {};
  
  measurements.forEach((m) => {
    if (!operationStats[m.operation]) {
      operationStats[m.operation] = { count: 0, totalTime: 0, average: 0 };
    }
    operationStats[m.operation].count++;
    operationStats[m.operation].totalTime += m.duration;
    operationStats[m.operation].average = operationStats[m.operation].totalTime / operationStats[m.operation].count;
  });
  
  // Sort by most expensive operations
  const sortedOperations = Object.entries(operationStats)
    .sort((a, b) => b[1].average - a[1].average)
    .map(([operation, stats]) => ({
      operation,
      count: stats.count,
      averageMs: stats.average.toFixed(2),
      totalMs: stats.totalTime.toFixed(2),
    }));
  
  return {
    operations: sortedOperations,
    measurementCount: measurements.length,
  };
}

/**
 * Clear all performance measurements
 */
export function clearPerformanceMeasurements() {
  measurements.length = 0;
}
