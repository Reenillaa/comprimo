import { zipSync } from 'fflate';
import { uniqueNames } from '../engine/naming';
import { isSupportedKind, sniff, unsupportedMessage, type SniffResult } from '../engine/sniff';
import { FORMAT_LABEL, MAX_PIXELS } from '../engine/types';

export async function sha256(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface Precheck {
  info: SniffResult;
  error?: string;
}

/** Cheap validation on the main thread (first 64 KiB) so bad files fail instantly. */
export async function precheck(file: Blob): Promise<Precheck> {
  const head = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
  const info = sniff(head);
  if (file.size === 0) return { info, error: 'El archivo está vacío.' };
  if (!isSupportedKind(info.kind)) return { info, error: unsupportedMessage(info.kind) };
  if (info.animated) {
    return { info, error: `Imagen ${FORMAT_LABEL[info.kind]} animada: la animación se perdería, así que no se procesa.` };
  }
  if (info.width && info.height && info.width * info.height > MAX_PIXELS) {
    return { info, error: `Imagen de ${Math.round((info.width * info.height) / 1e6)} MP: supera el máximo técnico de ${MAX_PIXELS / 1e6} MP del navegador.` };
  }
  return { info };
}

/** Build a ZIP (store, no recompression: the images are already compressed). */
export async function buildZip(entries: { name: string; blob: Blob }[]): Promise<Blob> {
  const names = uniqueNames(entries.map((e) => e.name));
  const files: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (let i = 0; i < entries.length; i++) {
    files[names[i]] = [new Uint8Array(await entries[i].blob.arrayBuffer()), { level: 0 }];
  }
  const zipped = zipSync(files);
  return new Blob([zipped as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
