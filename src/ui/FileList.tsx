import { useState } from 'react';
import { savings, formatBytes, formatPercent } from '../engine/stats';
import { FORMAT_LABEL, type ImageFormat } from '../engine/types';
import type { Item } from '../app/useCompressor';

interface Props {
  items: Item[];
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onCompare: (id: string) => void;
  onProcessDuplicate: (id: string) => void;
}

const kindLabel = (k?: string) =>
  k && k in FORMAT_LABEL ? FORMAT_LABEL[k as ImageFormat] : k === 'unknown' ? 'Desconocido' : k ? k.toUpperCase() : '';

function Thumb({ item }: { item: Item }) {
  const [broken, setBroken] = useState(false);
  const src = item.result?.url ?? item.originalUrl;
  // Only hand validated images to <img>: never let the renderer parse unchecked content.
  if (broken || item.rejected || item.status === 'checking') {
    return (
      <div className="thumb thumb-fallback" aria-hidden="true">
        {item.kind === 'unknown' ? '?' : kindLabel(item.result?.format ?? item.kind) || '…'}
      </div>
    );
  }
  return <img className="thumb" src={src} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />;
}

function Row({ item, ...a }: { item: Item } & Omit<Props, 'items'>) {
  const r = item.result;
  const s = r ? savings(item.size, r.size) : undefined;
  const busy = item.status === 'queued' || item.status === 'processing' || item.status === 'checking';
  const pct = Math.round(item.progress * 100);

  return (
    <li className={`row status-${item.status}`} data-testid="file-row" data-status={item.status} data-name={item.name}>
      <Thumb item={item} />
      <div className="row-main">
        <div className="row-name" title={item.name}>
          {item.name}
        </div>
        <div className="row-meta">
          <span>{formatBytes(item.size)}</span>
          {item.kind && <span>{kindLabel(item.kind)}</span>}
          {r && (
            <span>
              → {FORMAT_LABEL[r.format]} · {r.width}×{r.height}
              {r.lossless ? ' · sin pérdida' : r.quality !== undefined ? (r.format === 'png' ? ` · ${r.quality} colores` : ` · calidad ${r.quality}`) : ''}
            </span>
          )}
        </div>

        {busy && (
          <div className="progress" role="progressbar" aria-label={`Progreso de ${item.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={`${item.label} ${pct} %`}>
            <div className="progress-bar" style={{ width: `${Math.max(4, pct)}%` }} />
            <span className="progress-label">{item.label}</span>
          </div>
        )}
        {item.status === 'error' && (
          <p className="row-error" role="alert" data-testid="row-error">
            {item.error}
          </p>
        )}
        {item.status === 'cancelled' && <p className="row-muted">Cancelado.</p>}
        {item.status === 'duplicate' && (
          <p className="row-muted" data-testid="row-duplicate">
            Duplicado: ya está en la lista, así que no se procesa otra vez.
          </p>
        )}
        {r && r.warnings.length > 0 && (
          <ul className="row-warnings">
            {r.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        {r?.candidates && (
          <p className="row-muted">
            Probados: {r.candidates.map((c) => `${FORMAT_LABEL[c.format]} ${formatBytes(c.size)}`).join(' · ')}
          </p>
        )}
      </div>

      <div className="row-result">
        {r && s && (
          <>
            <span className="row-size" data-testid="result-size" data-bytes={r.size}>
              {formatBytes(r.size)}
            </span>
            <span className={`badge ${s.percent > 0 ? 'badge-good' : 'badge-neutral'}`} data-testid="result-savings">
              {s.percent > 0 ? `−${formatPercent(s.percent)}` : s.percent < 0 ? `+${formatPercent(-s.percent)}` : '0 %'}
            </span>
          </>
        )}
      </div>

      <div className="row-actions">
        {busy && (
          <button type="button" className="btn btn-small btn-ghost" onClick={() => a.onCancel(item.id)} aria-label={`Cancelar ${item.name}`}>
            Cancelar
          </button>
        )}
        {r && (
          <>
            <button type="button" className="btn btn-small btn-ghost" onClick={() => a.onCompare(item.id)} aria-label={`Comparar ${item.name}`}>
              Comparar
            </button>
            <a className="btn btn-small btn-primary" href={r.url} download={r.name} data-testid="download-link" aria-label={`Descargar ${r.name}`}>
              Descargar
            </a>
          </>
        )}
        {(item.status === 'error' || item.status === 'cancelled') && !item.rejected && (
          <button type="button" className="btn btn-small btn-ghost" onClick={() => a.onRetry(item.id)} aria-label={`Reintentar ${item.name}`}>
            Reintentar
          </button>
        )}
        {item.status === 'duplicate' && (
          <button type="button" className="btn btn-small btn-ghost" onClick={() => a.onProcessDuplicate(item.id)}>
            Procesar igualmente
          </button>
        )}
        {!busy && (
          <button type="button" className="btn btn-small btn-icon" onClick={() => a.onRemove(item.id)} aria-label={`Quitar ${item.name} de la lista`} title="Quitar">
            ×
          </button>
        )}
      </div>
    </li>
  );
}

export function FileList({ items, ...actions }: Props) {
  return (
    <ul className="file-list" aria-label="Imágenes">
      {items.map((it) => (
        <Row key={it.id} item={it} {...actions} />
      ))}
    </ul>
  );
}
