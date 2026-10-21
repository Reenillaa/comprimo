import { useState } from 'react';
import { formatBytes, formatPercent, savings } from '../engine/stats';
import { FORMAT_LABEL, type ImageFormat } from '../engine/types';
import type { Item } from '../app/useCompressor';
import { Icon, ProgressRing } from './effects';

interface Props {
  items: Item[];
  view: 'grid' | 'list';
  canReveal: boolean;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onCompare: (id: string) => void;
  onProcessDuplicate: (id: string) => void;
  onReveal: (path: string) => void;
}

const kindLabel = (k?: string) =>
  k && k in FORMAT_LABEL ? FORMAT_LABEL[k as ImageFormat] : k === 'unknown' ? 'Desconocido' : k ? k.toUpperCase() : '';

function Media({ item }: { item: Item }) {
  const [broken, setBroken] = useState(false);
  // Only validated images reach <img>: the renderer never parses unchecked content.
  const src = item.result?.thumbUrl ?? (item.rejected || item.status === 'checking' ? undefined : item.originalUrl);
  if (!src || broken) {
    return (
      <div className="card-fallback" aria-hidden="true">
        <Icon name={item.status === 'error' ? 'alert' : 'camera'} size={30} />
        <span>{item.kind === 'unknown' ? '?' : kindLabel(item.result?.format ?? item.kind)}</span>
      </div>
    );
  }
  return <img className="card-img" src={src} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setBroken(true)} />;
}

function Card({ item, index, ...a }: { item: Item; index: number } & Omit<Props, 'items' | 'view'>) {
  const r = item.result;
  const s = r ? savings(item.size, r.size) : undefined;
  const busy = item.status === 'queued' || item.status === 'processing' || item.status === 'checking';
  const pct = Math.round(item.progress * 100);

  return (
    <li
      className={`card status-${item.status}`}
      style={{ '--i': Math.min(index, 12) } as React.CSSProperties}
      data-testid="file-row"
      data-status={item.status}
      data-name={item.name}
    >
      <div className="card-media">
        <Media item={item} />
        {item.origin === 'session' && (
          <span className="chip chip-session">
            <Icon name="camera" size={12} /> Sesión
          </span>
        )}
        {busy && (
          <div
            className="card-progress"
            role="progressbar"
            aria-label={`Progreso de ${item.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-valuetext={`${item.label} ${pct} %`}
          >
            <ProgressRing value={item.progress} />
            <span className="card-progress-pct">{item.status === 'queued' || item.status === 'checking' ? '' : `${pct}%`}</span>
            <span className="card-progress-label">{item.label}</span>
          </div>
        )}
        {r && s && (
          <span className={`badge ${s.percent > 0 ? 'badge-good' : 'badge-neutral'}`} data-testid="result-savings">
            {s.percent > 0 ? `−${formatPercent(s.percent)}` : s.percent < 0 ? `+${formatPercent(-s.percent)}` : '0 %'}
          </span>
        )}
        {r && (
          <div className="card-hover">
            <button type="button" className="btn btn-glass btn-small" onClick={() => a.onCompare(item.id)} aria-label={`Comparar ${item.name}`}>
              <Icon name="eye" size={16} /> Comparar
            </button>
          </div>
        )}
      </div>

      <div className="card-body">
        <div className="card-name" title={item.name}>
          {item.name}
        </div>
        <div className="card-meta">
          {r ? (
            <span className="sizes">
              <span className="muted">{formatBytes(item.size)}</span>
              <Icon name="download" size={12} className="arrow" />
              <strong data-testid="result-size" data-bytes={r.size}>
                {formatBytes(r.size)}
              </strong>
            </span>
          ) : (
            <span className="muted">
              {formatBytes(item.size)}
              {item.kind ? ` · ${kindLabel(item.kind)}` : ''}
            </span>
          )}
        </div>
        {r && (
          <div className="card-detail">
            → {FORMAT_LABEL[r.format]} · {r.width}×{r.height}
            {r.lossless ? ' · sin pérdida' : r.quality !== undefined ? (r.format === 'png' ? ` · ${r.quality} colores` : ` · calidad ${r.quality}`) : ''}
          </div>
        )}

        {item.status === 'error' && (
          <p className="card-error" role="alert" data-testid="row-error">
            {item.error}
          </p>
        )}
        {item.status === 'cancelled' && <p className="card-muted">Cancelado.</p>}
        {item.status === 'duplicate' && (
          <p className="card-muted" data-testid="row-duplicate">
            Duplicada: ya está en la lista.
          </p>
        )}
        {r && r.warnings.length > 0 && (
          <ul className="card-warnings">
            {r.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        {r?.candidates && <p className="card-muted">Probados: {r.candidates.map((c) => `${FORMAT_LABEL[c.format]} ${formatBytes(c.size)}`).join(' · ')}</p>}
        {item.saveError && <p className="card-error">No se pudo guardar: {item.saveError}</p>}

        <div className="card-actions">
          {busy && (
            <button type="button" className="btn btn-ghost btn-small" onClick={() => a.onCancel(item.id)} aria-label={`Cancelar ${item.name}`}>
              <Icon name="stop" size={14} /> Cancelar
            </button>
          )}
          {r && item.savedPath && a.canReveal && (
            <button type="button" className="btn btn-ghost btn-small" onClick={() => a.onReveal(item.savedPath!)} aria-label={`Mostrar ${r.name} en la carpeta`} data-testid="reveal">
              <Icon name="folder" size={14} /> Mostrar
            </button>
          )}
          {r && (
            <a className="btn btn-primary btn-small" href={r.url} download={r.name} data-testid="download-link" aria-label={`Descargar ${r.name}`}>
              <Icon name="download" size={14} /> Descargar
            </a>
          )}
          {(item.status === 'error' || item.status === 'cancelled') && !item.rejected && (
            <button type="button" className="btn btn-ghost btn-small" onClick={() => a.onRetry(item.id)} aria-label={`Reintentar ${item.name}`}>
              <Icon name="retry" size={14} /> Reintentar
            </button>
          )}
          {item.status === 'duplicate' && (
            <button type="button" className="btn btn-ghost btn-small" onClick={() => a.onProcessDuplicate(item.id)}>
              Procesar igualmente
            </button>
          )}
          {!busy && (
            <button type="button" className="btn btn-icon" onClick={() => a.onRemove(item.id)} aria-label={`Quitar ${item.name} de la lista`} title="Quitar">
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export function Gallery({ items, view, ...actions }: Props) {
  return (
    <ul className={`gallery is-${view}`} aria-label="Imágenes">
      {items.map((it, i) => (
        <Card key={it.id} item={it} index={i} {...actions} />
      ))}
    </ul>
  );
}
