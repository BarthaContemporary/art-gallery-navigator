
export type WorkerTaskType = 'HEAVY_COMPUTATION' | 'FILE_PROCESSING';

export interface WorkerTask {
  id: string;
  type: WorkerTaskType;
  data: unknown;
}

export interface WorkerSuccessResponse {
  id: string;
  type: 'RESULT';
  result: unknown;
}

export interface WorkerErrorResponse {
  id: string;
  type: 'ERROR';
  error: string;
}

export type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;

export interface FileProcessingResult {
  name: string;
  size: number;
  type: string;
  processed: boolean;
}

export interface HeavyComputationResult {
  value: number;
}
