/// <reference lib="webworker" />
import { processImage } from '../engine/pipeline';
import { ProcessingError } from '../engine/types';
import { browserCodecs } from './browser-codecs';
import type { JobRequest, WorkerMessage } from './protocol';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const post = (msg: WorkerMessage, transfer: Transferable[] = []) => scope.postMessage(msg, transfer);

scope.onmessage = async (e: MessageEvent<JobRequest>) => {
  const { id, bytes, options } = e.data;
  let last = 0;
  try {
    const result = await processImage(new Uint8Array(bytes), options, browserCodecs, {
      thumbnail: 512,
      onProgress: (fraction, label) => {
        // Throttle: progress messages are cheap but there is no point sending hundreds.
        if (fraction - last >= 0.02 || fraction === 1) {
          last = fraction;
          post({ id, type: 'progress', fraction, label });
        }
      },
    });
    // Transfer an exactly-sized buffer.
    const out =
      result.bytes.byteOffset === 0 && result.bytes.byteLength === result.bytes.buffer.byteLength
        ? result.bytes
        : result.bytes.slice();
    const transfer: Transferable[] = [out.buffer];
    if (result.thumbnail) transfer.push(result.thumbnail.buffer);
    post({ id, type: 'done', result: { ...result, bytes: out } }, transfer);
  } catch (err) {
    const code = err instanceof ProcessingError ? err.code : 'internal';
    const message =
      err instanceof ProcessingError
        ? err.message
        : `Error inesperado al procesar: ${(err as Error)?.message ?? String(err)}`;
    post({ id, type: 'error', code, message });
  }
};
