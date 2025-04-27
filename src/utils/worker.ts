
import { WorkerTask, WorkerResponse, FileProcessingResult, HeavyComputationResult } from './worker-types';

function heavyComputation(data: number): HeavyComputationResult {
  let value = 0;
  for (let i = 0; i < 1000000; i++) {
    value += Math.sqrt(data + i);
  }
  return { value };
}

function processFile(file: File): FileProcessingResult {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    processed: true
  };
}

self.onmessage = (event: MessageEvent<WorkerTask>) => {
  const { id, type, data } = event.data;

  try {
    let result: unknown;

    switch (type) {
      case 'HEAVY_COMPUTATION':
        if (typeof data !== 'number') {
          throw new Error('Heavy computation requires numeric input');
        }
        result = heavyComputation(data);
        break;

      case 'FILE_PROCESSING':
        if (!(data instanceof File)) {
          throw new Error('File processing requires File input');
        }
        result = processFile(data);
        break;

      default:
        throw new Error(`Unsupported task type: ${type}`);
    }

    const response: WorkerResponse = { id, type: 'RESULT', result };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = { 
      id, 
      type: 'ERROR', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
    self.postMessage(response);
  }
};

// Required for TypeScript module workers
export {};
