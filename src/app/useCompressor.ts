import { useCallback, useEffect, useRef, useState } from 'react';
import { outputName, withSuffix } from '../engine/naming';
import type { SniffedKind } from '../engine/sniff';
import type { ImageFormat, ProcessOptions } from '../engine/types';
import { JobError, WorkerPool } from '../worker/pool';
import { precheck, sha256 } from './files';

export type ItemStatus = 'checking' | 'queued' | 'processing' | 'done' | 'error' | 'cancelled' | 'duplicate';

export interface ItemResult {
  blob: Blob;
  url: string;
  name: string;
  size: number;
  format: ImageFormat;
  width: number;
  height: number;
  quality?: number;
  lossless: boolean;
  ssim?: number;
  usedOriginal: boolean;
  larger: boolean;
  warnings: string[];
  candidates?: { format: ImageFormat; size: number }[];
  /** Object URL of the small WebP preview produced by the worker. */
  thumbUrl?: string;
  ms: number;
}

export interface Item {
  id: string;
  file: File;
  name: string;
  size: number;
  kind?: SniffedKind;
  hash?: string;
  status: ItemStatus;
  progress: number;
  label: string;
  error?: string;
  /** Failed the content check (unsupported, animated, empty…): retrying cannot help. */
  rejected?: boolean;
  duplicateOf?: string;
  originalUrl: string;
  result?: ItemResult;
  options: ProcessOptions;
  /** 'session' = arrived from the watched folder. */
  origin: 'manual' | 'session';
  savedPath?: string;
  saveError?: string;
  addedAt: number;
}

export interface CompressorHooks {
  /** Suffix added to output names ("_web"). */
  suffix: string;
  /** Called once per finished item; return the saved path (desktop) or nothing. */
  onDone?: (item: Item, result: ItemResult) => Promise<string | void>;
}

const revoke = (it: Item) => {
  URL.revokeObjectURL(it.originalUrl);
  if (it.result) {
    URL.revokeObjectURL(it.result.url);
    if (it.result.thumbUrl) URL.revokeObjectURL(it.result.thumbUrl);
  }
};

let counter = 0;
const newId = () => `img-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function useCompressor(options: ProcessOptions, hooks: CompressorHooks) {
  const [items, setItems] = useState<Item[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const poolRef = useRef<WorkerPool | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const hooksRef = useRef(hooks);
  hooksRef.current = hooks;

  const pool = () => (poolRef.current ??= new WorkerPool());

  useEffect(
    () => () => {
      poolRef.current?.dispose();
      poolRef.current = null;
      for (const it of itemsRef.current) revoke(it);
    },
    [],
  );

  const patch = useCallback((id: string, p: Partial<Item> | ((it: Item) => Partial<Item>)) => {
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...(typeof p === 'function' ? p(it) : p) } : it)));
  }, []);

  const start = useCallback(
    (item: Item, opts: ProcessOptions) => {
      patch(item.id, (it) => {
        if (it.result) {
          URL.revokeObjectURL(it.result.url);
          if (it.result.thumbUrl) URL.revokeObjectURL(it.result.thumbUrl);
        }
        return { status: 'queued', progress: 0, label: 'En cola', error: undefined, result: undefined, options: opts, savedPath: undefined, saveError: undefined };
      });
      pool()
        .run(item.id, () => item.file.arrayBuffer(), opts, (fraction, label) =>
          patch(item.id, { status: 'processing', progress: fraction, label }),
        )
        .then((r) => {
          const blob = new Blob([r.bytes as Uint8Array<ArrayBuffer>], { type: r.mime });
          const result: ItemResult = {
            blob,
            url: URL.createObjectURL(blob),
            name: r.usedOriginal ? withSuffix(item.name, hooksRef.current.suffix) : withSuffix(outputName(item.name, r.format), hooksRef.current.suffix),
            size: blob.size,
            format: r.format,
            width: r.width,
            height: r.height,
            quality: r.quality,
            lossless: r.lossless,
            ssim: r.ssim,
            usedOriginal: r.usedOriginal,
            larger: r.larger,
            warnings: r.warnings,
            candidates: r.candidates,
            thumbUrl: r.thumbnail ? URL.createObjectURL(new Blob([r.thumbnail as Uint8Array<ArrayBuffer>], { type: 'image/webp' })) : undefined,
            ms: r.ms,
          };
          patch(item.id, { status: 'done', progress: 1, label: 'Terminado', result });
          const onDone = hooksRef.current.onDone;
          if (onDone) {
            onDone(item, result).then(
              (savedPath) => savedPath && patch(item.id, { savedPath }),
              (err: Error) => patch(item.id, { saveError: err.message || 'No se pudo guardar.' }),
            );
          }
        })
        .catch((e: Error) => {
          const cancelled = e instanceof JobError && e.code === 'cancelled';
          patch(item.id, {
            status: cancelled ? 'cancelled' : 'error',
            progress: 0,
            label: cancelled ? 'Cancelado' : 'Error',
            error: cancelled ? undefined : e.message,
          });
        });
    },
    [patch],
  );

  const addFiles = useCallback(
    async (files: File[], origin: Item['origin'] = 'manual') => {
      const opts = optionsRef.current;
      const fresh: Item[] = files.map((file) => ({
        origin,
        addedAt: Date.now(),
        id: newId(),
        file,
        name: file.name || 'imagen',
        size: file.size,
        status: 'checking',
        progress: 0,
        label: 'Comprobando',
        originalUrl: URL.createObjectURL(file),
        options: opts,
      }));
      setItems((list) => [...list, ...fresh]);
      const knownHashes = new Map(itemsRef.current.filter((i) => i.hash).map((i) => [i.hash!, i.id]));
      for (const item of fresh) {
        try {
          const [check, hash] = await Promise.all([precheck(item.file), sha256(item.file)]);
          if (check.error) {
            patch(item.id, { kind: check.info.kind, hash, status: 'error', label: 'Error', error: check.error, rejected: true });
            continue;
          }
          const dup = knownHashes.get(hash);
          if (dup) {
            patch(item.id, { kind: check.info.kind, hash, status: 'duplicate', label: 'Duplicado', duplicateOf: dup });
            continue;
          }
          knownHashes.set(hash, item.id);
          patch(item.id, { kind: check.info.kind, hash });
          start(item, opts);
        } catch {
          patch(item.id, { status: 'error', label: 'Error', error: 'No se pudo leer el archivo.', rejected: true });
        }
      }
    },
    [patch, start],
  );

  const cancel = useCallback((id: string) => {
    poolRef.current?.cancel(id);
  }, []);

  const cancelAll = useCallback(() => {
    poolRef.current?.cancelAll();
  }, []);

  const retry = useCallback(
    (id: string, useCurrentOptions = true) => {
      const it = itemsRef.current.find((i) => i.id === id);
      if (it) start(it, useCurrentOptions ? optionsRef.current : it.options);
    },
    [start],
  );

  /** Re-run every finished/failed item with the current settings. */
  const reprocessAll = useCallback(() => {
    for (const it of itemsRef.current) {
      if (!it.rejected && ['done', 'error', 'cancelled'].includes(it.status)) start(it, optionsRef.current);
    }
  }, [start]);

  const remove = useCallback((id: string) => {
    poolRef.current?.cancel(id);
    setItems((list) => {
      const it = list.find((i) => i.id === id);
      if (it) revoke(it);
      return list.filter((i) => i.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    poolRef.current?.cancelAll();
    setItems((list) => {
      for (const it of list) revoke(it);
      return [];
    });
  }, []);

  /** Process a duplicate anyway. */
  const processDuplicate = useCallback(
    (id: string) => {
      const it = itemsRef.current.find((i) => i.id === id);
      if (it) start(it, optionsRef.current);
    },
    [start],
  );

  return { items, addFiles, cancel, cancelAll, retry, reprocessAll, remove, clear, processDuplicate };
}
