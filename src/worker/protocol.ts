import type { ProcessOptions, ProcessResult } from '../engine/types';

export interface JobRequest {
  id: string;
  bytes: ArrayBuffer;
  options: ProcessOptions;
}

export type WorkerMessage =
  | { id: string; type: 'progress'; fraction: number; label: string }
  | { id: string; type: 'done'; result: ProcessResult }
  | { id: string; type: 'error'; code: string; message: string };
