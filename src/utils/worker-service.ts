
/**
 * Web Worker service for offloading CPU-intensive operations to background threads
 */

type WorkerTask = {
  taskId: string;
  functionName: string;
  args: any[];
};

type WorkerResponse = {
  taskId: string;
  result?: any;
  error?: string;
};

// We'll use a single worker instance that can handle multiple task types
let worker: Worker | null = null;

// Map of pending task callbacks
const taskCallbacks = new Map<
  string,
  { resolve: (value: any) => void; reject: (reason?: any) => void }
>();

// Initialize worker if supported
function ensureWorker() {
  if (!worker && typeof Worker !== 'undefined') {
    // Worker code as a blob
    const workerCode = `
      // Set up worker message handler
      self.onmessage = function(e) {
        const { taskId, functionName, args } = e.data;
        
        try {
          // Execute different types of tasks based on function name
          let result;
          
          if (functionName === 'processImages') {
            result = processImages(...args);
          } else if (functionName === 'formatData') {
            result = formatData(...args);
          } else if (functionName === 'computeStats') {
            result = computeStats(...args);
          } else {
            throw new Error('Unknown function: ' + functionName);
          }
          
          // Send successful result back
          self.postMessage({ taskId, result });
        } catch (error) {
          // Send error back
          self.postMessage({ 
            taskId, 
            error: error instanceof Error ? error.message : String(error)
          });
        }
      };
      
      // Image processing function
      function processImages(images) {
        // Placeholder for actual image processing
        return images.map(img => ({
          ...img,
          processed: true,
          processedAt: new Date().toISOString()
        }));
      }
      
      // Data formatting function
      function formatData(data, options) {
        // Format the data based on options
        const result = { formatted: true, items: [] };
        
        // Do CPU-intensive work
        for (const item of data) {
          let processed = { ...item };
          
          // Apply transformations based on options
          if (options.uppercase && item.name) {
            processed.name = item.name.toUpperCase();
          }
          
          // More complex processing here
          // ...
          
          result.items.push(processed);
        }
        
        return result;
      }
      
      // Statistics computation function
      function computeStats(data) {
        // Compute statistics from the data
        const result = {
          count: data.length,
          numeric: {}
        };
        
        // Process all number fields and compute statistics
        if (data.length > 0) {
          const sample = data[0];
          const numericFields = Object.keys(sample).filter(key => 
            typeof sample[key] === 'number'
          );
          
          numericFields.forEach(field => {
            const values = data.map(item => item[field]).filter(v => typeof v === 'number');
            
            if (values.length) {
              const sum = values.reduce((a, b) => a + b, 0);
              const avg = sum / values.length;
              const min = Math.min(...values);
              const max = Math.max(...values);
              
              result.numeric[field] = {
                min, max, avg, sum
              };
            }
          });
        }
        
        return result;
      }
    `;

    // Create a blob from the worker code
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    
    // Create the worker
    worker = new Worker(url);
    
    // Set up message handler
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { taskId, result, error } = e.data;
      const callbacks = taskCallbacks.get(taskId);
      
      if (callbacks) {
        if (error) {
          callbacks.reject(new Error(error));
        } else {
          callbacks.resolve(result);
        }
        taskCallbacks.delete(taskId);
      }
    };
  }
}

/**
 * Process images in the background
 */
export async function processImagesInBackground<T>(images: T[]): Promise<T[]> {
  return executeWorkerTask('processImages', [images]);
}

/**
 * Format data in the background
 */
export async function formatDataInBackground<T>(data: T[], options: any): Promise<{ formatted: boolean; items: T[] }> {
  return executeWorkerTask('formatData', [data, options]);
}

/**
 * Compute statistics in the background
 */
export async function computeStatsInBackground<T>(data: T[]): Promise<any> {
  return executeWorkerTask('computeStats', [data]);
}

/**
 * Execute a task in the worker
 */
async function executeWorkerTask<T>(functionName: string, args: any[]): Promise<T> {
  ensureWorker();
  
  // If worker is not supported, execute the task directly
  if (!worker) {
    console.warn('Web Worker not supported in this environment. Executing task on main thread.');
    return Promise.resolve<any>(null);
  }
  
  // Generate a unique task ID
  const taskId = `${functionName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return new Promise<T>((resolve, reject) => {
    // Store the callbacks
    taskCallbacks.set(taskId, { resolve, reject });
    
    // Send the task to the worker
    worker!.postMessage({
      taskId,
      functionName,
      args
    });
  });
}

/**
 * Terminate the worker when it's no longer needed
 */
export function terminateWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}
