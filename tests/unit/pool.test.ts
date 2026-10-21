import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, type ProcessResult } from '../../src/engine/types';
import { JobError, WorkerPool } from '../../src/worker/pool';
import type { JobRequest, WorkerMessage } from '../../src/worker/protocol';

type Behaviour = 'ok' | 'hang' | 'crash' | 'fail';

/** Minimal stand-in for a Worker; behaviour is chosen by the first byte of the job. */
class FakeWorker {
  onmessage: ((e: MessageEvent<WorkerMessage>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  terminated = false;
  static created = 0;
  constructor() {
    FakeWorker.created++;
  }
  postMessage(req: JobRequest) {
    const b = new Uint8Array(req.bytes)[0];
    const behaviour: Behaviour = (['ok', 'hang', 'crash', 'fail'] as const)[b];
    setTimeout(() => {
      if (this.terminated) return;
      const send = (m: WorkerMessage) => this.onmessage?.({ data: m } as MessageEvent<WorkerMessage>);
      if (behaviour === 'ok') {
        send({ id: req.id, type: 'progress', fraction: 0.5, label: 'Optimizando' });
        send({ id: req.id, type: 'done', result: { bytes: new Uint8Array([9]) } as unknown as ProcessResult });
      } else if (behaviour === 'crash') this.onerror?.({ preventDefault() {} } as ErrorEvent);
      else if (behaviour === 'fail') send({ id: req.id, type: 'error', code: 'corrupt', message: 'dañado' });
    }, 5);
  }
  terminate() {
    this.terminated = true;
  }
}

const job = (b: number) => async () => new Uint8Array([b]).buffer;
const make = (size = 1) => new WorkerPool(size, () => new FakeWorker() as unknown as Worker);

describe('WorkerPool', () => {
  it('procesa en orden y reporta progreso', async () => {
    const pool = make(1);
    const labels: string[] = [];
    const r = await pool.run('a', job(0), DEFAULT_OPTIONS, (_, l) => labels.push(l));
    expect(r.bytes).toEqual(new Uint8Array([9]));
    expect(labels).toContain('Optimizando');
  });

  it('cancelar un trabajo en curso termina el worker y sigue con la cola', async () => {
    const pool = make(1);
    const before = FakeWorker.created;
    const hung = pool.run('h', job(1), DEFAULT_OPTIONS, () => {});
    const next = pool.run('n', job(0), DEFAULT_OPTIONS, () => {});
    await new Promise((r) => setTimeout(r, 20));
    expect(pool.cancel('h')).toBe(true);
    await expect(hung).rejects.toMatchObject({ code: 'cancelled' });
    await expect(next).resolves.toBeTruthy();
    expect(FakeWorker.created).toBe(before + 1); // replacement worker
  });

  it('cancelar un trabajo en cola no toca los workers', async () => {
    const pool = make(1);
    const first = pool.run('1', job(0), DEFAULT_OPTIONS, () => {});
    const queued = pool.run('2', job(0), DEFAULT_OPTIONS, () => {});
    pool.cancel('2');
    await expect(queued).rejects.toBeInstanceOf(JobError);
    await expect(first).resolves.toBeTruthy();
  });

  it('si el worker se cae (p. ej. sin memoria) el trabajo falla con mensaje y el pool se recupera', async () => {
    const pool = make(1);
    await expect(pool.run('c', job(2), DEFAULT_OPTIONS, () => {})).rejects.toMatchObject({ code: 'crashed' });
    await expect(pool.run('ok', job(0), DEFAULT_OPTIONS, () => {})).resolves.toBeTruthy();
  });

  it('errores del motor llegan con su código', async () => {
    const pool = make(2);
    await expect(pool.run('f', job(3), DEFAULT_OPTIONS, () => {})).rejects.toMatchObject({ code: 'corrupt', message: 'dañado' });
  });

  it('cancelAll vacía cola y trabajos en curso', async () => {
    const pool = make(2);
    const ps = [0, 1, 2].map((i) => pool.run(`x${i}`, job(1), DEFAULT_OPTIONS, () => {}));
    await new Promise((r) => setTimeout(r, 10));
    pool.cancelAll();
    for (const p of ps) await expect(p).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('error al leer el archivo', async () => {
    const pool = make(1);
    await expect(
      pool.run('r', () => Promise.reject(new Error('io')), DEFAULT_OPTIONS, () => {}),
    ).rejects.toMatchObject({ code: 'read' });
  });
});
