import { forwardRef, useState } from 'react';
import { formatBytes, totals } from '../engine/stats';
import type { Item } from '../app/useCompressor';
import { buildZip, downloadBlob } from '../app/files';
import { Icon, useCountUp } from './effects';

interface Props {
  items: Item[];
  view: 'grid' | 'list';
  onView: (v: 'grid' | 'list') => void;
  onCancelAll: () => void;
  onReprocess: () => void;
  onClear: () => void;
  outputDir?: string;
  onOpenOutput?: () => void;
}

const nf1 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const StatsBar = forwardRef<HTMLParagraphElement, Props>(function StatsBar(
  { items, view, onView, onCancelAll, onReprocess, onClear, outputDir, onOpenOutput },
  headlineRef,
) {
  const [zipping, setZipping] = useState(false);
  const done = items.filter((i) => i.status === 'done' && i.result);
  const busy = items.filter((i) => ['checking', 'queued', 'processing'].includes(i.status));
  const failed = items.filter((i) => i.status === 'error').length;
  const t = totals(done.map((i) => ({ original: i.size, result: i.result!.size })));
  const animated = useCountUp(Math.max(0, t.percent));
  const overall = items.length ? items.reduce((s, i) => s + (i.status === 'done' || i.status === 'error' || i.status === 'duplicate' || i.status === 'cancelled' ? 1 : i.progress), 0) / items.length : 0;

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
    <section className="stats" aria-label="Resumen del lote">
      <div className="stats-main">
        <p ref={headlineRef} className="stats-headline" data-testid="summary-headline">
          {done.length === 0 ? (
            busy.length ? (
              <span className="shimmer-text">Optimizando…</span>
            ) : (
              'Nada terminado todavía'
            )
          ) : t.bytes > 0 ? (
            <>
              <span className="visually-hidden">Has ahorrado {nf1.format(t.percent)} %</span>
              <span aria-hidden="true">
                <span className="stats-big">−{nf1.format(animated)}%</span>
                <span className="stats-label">de peso ahorrado</span>
              </span>
            </>
          ) : (
            'Sin ahorro en este lote'
          )}
        </p>
        <p className="stats-detail" data-testid="summary-detail" data-original={t.original} data-result={t.result}>
          {done.length > 0 && (
            <>
              {formatBytes(t.original)} → <strong>{formatBytes(t.result)}</strong> ({formatBytes(Math.max(0, t.bytes))} menos) ·{' '}
            </>
          )}
          {done.length} {done.length === 1 ? 'terminada' : 'terminadas'}
          {busy.length > 0 && ` · ${busy.length} en curso`}
          {failed > 0 && ` · ${failed} con error`}
        </p>
      </div>

      <div className="stats-actions">
        <div className="segmented segmented-icons" role="radiogroup" aria-label="Vista">
          <label className="segment" title="Cuadrícula">
            <input type="radio" name="view" checked={view === 'grid'} onChange={() => onView('grid')} aria-label="Cuadrícula" />
            <span>
              <Icon name="grid" size={16} />
            </span>
          </label>
          <label className="segment" title="Lista">
            <input type="radio" name="view" checked={view === 'list'} onChange={() => onView('list')} aria-label="Lista" />
            <span>
              <Icon name="list" size={16} />
            </span>
          </label>
        </div>
        {busy.length > 0 && (
          <button type="button" className="btn btn-ghost" onClick={onCancelAll}>
            <Icon name="stop" size={16} /> Cancelar todo
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onReprocess} disabled={busy.length > 0 || items.length === 0} title="Aplica los ajustes actuales a todas las imágenes">
          <Icon name="retry" size={16} /> Volver a procesar
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClear} disabled={items.length === 0}>
          <Icon name="trash" size={16} /> Vaciar lista
        </button>
        {outputDir && onOpenOutput && (
          <button type="button" className="btn btn-ghost" onClick={onOpenOutput}>
            <Icon name="folder" size={16} /> Abrir carpeta
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={zip} disabled={done.length === 0 || zipping} data-testid="download-all">
          <Icon name="zip" size={16} />
          {zipping ? 'Preparando ZIP…' : `Descargar todo (ZIP${done.length ? `, ${done.length}` : ''})`}
        </button>
      </div>
      <div className={`stats-progress${busy.length ? ' is-active' : ''}`} aria-hidden="true">
        <span style={{ width: `${Math.round(overall * 100)}%` }} />
      </div>
    </section>
  );
});
