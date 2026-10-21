import type { ProcessOptions, ProcessResult } from '../engine/types';
import type { JobRequest, WorkerMessage } from './protocol';

export class JobError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'JobError';
  }
}

interface Job {
  id: string;
  getBytes: () => Promise<ArrayBuffer>;
  options: ProcessOptions;
  onProgress: (fraction: number, label: string) => void;
  resolve: (r: ProcessResult) => void;
  reject: (e: Error) => void;
}

interface Slot {
  worker: Worker;
  job?: Job;
}

export type WorkerFactory = () => Worker;

const defaultFactory: WorkerFactory = () =>
  new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module', name: 'comprimo-engine' });

/**
 * Fixed-size worker pool with a FIFO queue. Cancelling a running job terminates its worker
 * (WASM encoders cannot be interrupted any other way) and starts a fresh one.
 */
export class WorkerPool {
  private slots: Slot[] = [];
  private queue: Job[] = [];

  constructor(
    size = WorkerPool.defaultSize(),
    private factory: WorkerFactory = defaultFactory,
  ) {
    for (let i = 0; i < size; i++) this.slots.push(this.spawn());
  }

  static defaultSize(): number {
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
    return Math.max(1, Math.min(4, cores - 1));
  }

  get size() {
    return this.slots.length;
  }

  run(
    id: string,
    getBytes: () => Promise<ArrayBuffer>,
    options: ProcessOptions,
    onProgress: (fraction: number, label: string) => void,
  ): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({ id, getBytes, options, onProgress, resolve, reject });
      this.pump();
    });
  }

  cancel(id: string): boolean {
    const qi = this.queue.findIndex((j) => j.id === id);
    if (qi >= 0) {
      const [job] = this.queue.splice(qi, 1);
      job.reject(new JobError('cancelled', 'Cancelado'));
      return true;
    }
    const slot = this.slots.find((s) => s.job?.id === id);
    if (slot) {
      this.recycle(slot, new JobError('cancelled', 'Cancelado'));
      this.pump();
      return true;
    }
    return false;
  }

  cancelAll() {
    for (const job of this.queue.splice(0)) job.reject(new JobError('cancelled', 'Cancelado'));
    for (const slot of this.slots) if (slot.job) this.recycle(slot, new JobError('cancelled', 'Cancelado'));
  }

  dispose() {
    this.cancelAll();
    for (const s of this.slots) s.worker.terminate();
    this.slots = [];
  }

  private spawn(): Slot {
    const slot: Slot = { worker: this.factory() };
    this.attach(slot);
    return slot;
  }

  private attach(slot: Slot) {
    slot.worker.onmessage = (e: MessageEvent<WorkerMessage>) => this.onMessage(slot, e.data);
    slot.worker.onerror = (e) => {
      e.preventDefault?.();
      this.recycle(slot, new JobError('crashed', 'El procesador se detuvo (posible falta de memoria). Reintenta o reduce la imagen.'));
      this.pump();
    };
  }

  /** Replace the slot's worker (the only way to stop a WASM encoder mid-run). */
  private recycle(slot: Slot, err: Error) {
    const job = slot.job;
    slot.job = undefined;
    slot.worker.terminate();
    slot.worker = this.factory();
    this.attach(slot);
    job?.reject(err);
  }

  private onMessage(slot: Slot, msg: WorkerMessage) {
    const job = slot.job;
    if (!job || job.id !== msg.id) return;
    if (msg.type === 'progress') {
      job.onProgress(msg.fraction, msg.label);
      return;
    }
    slot.job = undefined;
    if (msg.type === 'done') job.resolve(msg.result);
    else job.reject(new JobError(msg.code, msg.message));
    this.pump();
  }

  private pump() {
    for (const slot of this.slots) {
      if (slot.job || !this.queue.length) continue;
      const job = this.queue.shift()!;
      slot.job = job;
      job.onProgress(0, 'Leyendo archivo');
      job
        .getBytes()
        .then((bytes) => {
          if (slot.job !== job) return; // cancelled while reading
          const req: JobRequest = { id: job.id, bytes, options: job.options };
          slot.worker.postMessage(req, [bytes]);
        })
        .catch(() => {
          if (slot.job !== job) return;
          slot.job = undefined;
          job.reject(new JobError('read', 'No se pudo leer el archivo del disco.'));
          this.pump();
        });
    }
  }
}
