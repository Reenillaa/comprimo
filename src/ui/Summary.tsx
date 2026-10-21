import { useState } from 'react';
import { formatBytes, formatPercent, totals } from '../engine/stats';
import type { Item } from '../app/useCompressor';
import { buildZip, downloadBlob } from '../app/files';

interface Props {
  items: Item[];
  onCancelAll: () => void;
  onReprocess: () => void;
  onClear: () => void;
}

export function Summary({ items, onCancelAll, onReprocess, onClear }: Props) {
  const [zipping, setZipping] = useState(false);
  const done = items.filter((i) => i.status === 'done' && i.result);
  const busy = items.filter((i) => ['checking', 'queued', 'processing'].includes(i.status)).length;
  const failed = items.filter((i) => i.status === 'error').length;
  const t = totals(done.map((i) => ({ original: i.size, result: i.result!.size })));

  const zip = async () => {
    setZipping(true);
    try {
      const blob = await buildZip(done.map((i) => ({ name: i.result!.name, blob: i.result!.blob })));
      downloadBlob(blob, 'comprimo-imagenes.zip');
    } finally {
      setZipping(false);
    }
  };

  return (
    <section className="summary" aria-label="Resumen del lote">
      <div className="summary-stats">
        <p className="summary-headline" data-testid="summary-headline">
          {done.length === 0
            ? busy
              ? 'Optimizando…'
              : 'Nada terminado todavía'
            : t.bytes > 0
              ? `Has ahorrado ${formatPercent(t.percent)}`
              : 'Sin ahorro en este lote'}
        </p>
        <p className="summary-detail" data-testid="summary-detail" data-original={t.original} data-result={t.result}>
          {done.length > 0 && `${formatBytes(t.original)} → ${formatBytes(t.result)} (${formatBytes(Math.max(0, t.bytes))} menos) · `}
          {done.length} {done.length === 1 ? 'terminada' : 'terminadas'}
          {busy > 0 && ` · ${busy} en curso`}
          {failed > 0 && ` · ${failed} con error`}
        </p>
      </div>
      <div className="summary-actions">
        {busy > 0 && (
          <button type="button" className="btn btn-ghost" onClick={onCancelAll}>
            Cancelar todo
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onReprocess} disabled={busy > 0 || items.length === 0} title="Aplica los ajustes actuales a todas las imágenes">
          Volver a procesar
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClear} disabled={items.length === 0}>
          Vaciar lista
        </button>
        <button type="button" className="btn btn-primary" onClick={zip} disabled={done.length === 0 || zipping} data-testid="download-all">
          {zipping ? 'Preparando ZIP…' : `Descargar todo (ZIP${done.length ? `, ${done.length}` : ''})`}
        </button>
      </div>
    </section>
  );
}
