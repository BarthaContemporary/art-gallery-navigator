
type WorkerTask = {
  id: string;
  data: any;
  type: string;
}

export class WorkerService {
  private static worker: Worker | null = null;

  static initialize() {
    if (!this.worker) {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      
      this.worker.onmessage = (event) => {
        console.log('Worker message received:', event.data);
      };

      this.worker.onerror = (error) => {
        console.error('Worker error:', error);
      };
    }
    return this.worker;
  }

  static postTask(task: WorkerTask) {
    if (!this.worker) {
      this.initialize();
    }
    this.worker?.postMessage(task);
  }

  static terminate() {
    this.worker?.terminate();
    this.worker = null;
  }
}
