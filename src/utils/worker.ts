
// Web Worker for background processing
self.onmessage = (event: MessageEvent) => {
  const { id, type, data } = event.data;

  try {
    switch (type) {
      case 'HEAVY_COMPUTATION':
        const result = heavyComputation(data);
        self.postMessage({ id, type: 'RESULT', result });
        break;
      case 'FILE_PROCESSING':
        const processedFile = processFile(data);
        self.postMessage({ id, type: 'RESULT', result: processedFile });
        break;
      default:
        throw new Error(`Unsupported task type: ${type}`);
    }
  } catch (error) {
    self.postMessage({ 
      id, 
      type: 'ERROR', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

function heavyComputation(data: any) {
  // Simulate a heavy computation
  let result = 0;
  for (let i = 0; i < 1000000; i++) {
    result += Math.sqrt(data + i);
  }
  return result;
}

function processFile(file: File) {
  // Simulate file processing
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    processed: true
  };
}

// TypeScript compilation requires this for module workers
export {};
