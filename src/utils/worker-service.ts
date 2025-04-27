
import { WorkerTask, WorkerResponse } from './worker-types';

export class WorkerService {
  private static worker: Worker | null = null;
  private static taskCallbacks = new Map<string, { 
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  static initialize() {
    if (!this.worker) {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      
      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const { id, type, result, error } = event.data;
        const callback = this.taskCallbacks.get(id);
        
        if (callback) {
          clearTimeout(callback.timeout);
          this.taskCallbacks.delete(id);
          
          if (type === 'ERROR') {
            callback.reject(new Error(error));
          } else {
            callback.resolve(result);
          }
        }
      };

      this.worker.onerror = (error) => {
        console.error('Worker error:', error);
        // Reject all pending tasks
        this.taskCallbacks.forEach(callback => {
          callback.reject(new Error('Worker encountered a fatal error'));
          clearTimeout(callback.timeout);
        });
        this.taskCallbacks.clear();
        this.terminate();
      };
    }
    return this.worker;
  }

  static async postTask<T>(task: WorkerTask, timeoutMs = 30000): Promise<T> {
    if (!this.worker) {
      this.initialize();
    }

    return new Promise<T>((resolve, reject) => {
      // Set timeout to prevent hanging tasks
      const timeout = setTimeout(() => {
        const callback = this.taskCallbacks.get(task.id);
        if (callback) {
          this.taskCallbacks.delete(task.id);
          reject(new Error(`Task ${task.id} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      // Store callback for this task
      this.taskCallbacks.set(task.id, { resolve, reject, timeout });

      // Post message to worker
      this.worker?.postMessage(task);
    });
  }

  static terminate() {
    if (this.worker) {
      // Reject any pending tasks
      this.taskCallbacks.forEach(callback => {
        callback.reject(new Error('Worker was terminated'));
        clearTimeout(callback.timeout);
      });
      this.taskCallbacks.clear();
      
      this.worker.terminate();
      this.worker = null;
    }
  }
}
