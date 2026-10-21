import { useEffect, useRef, useState } from 'react';
import { formatBytes } from '../engine/stats';
import { FORMAT_LABEL } from '../engine/types';
import type { Item } from '../app/useCompressor';

interface Props {
  item: Item | undefined;
  onClose: () => void;
}

export function CompareDialog({ item, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pos, setPos] = useState(50);
  const [zoom, setZoom] = useState(false);
  const [afterBroken, setAfterBroken] = useState(false);
  const [beforeBroken, setBeforeBroken] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (item && !d.open) {
      setPos(50);
      setAfterBroken(false);
      setBeforeBroken(false);
      d.showModal();
    } else if (!item && d.open) d.close();
  }, [item]);

  const r = item?.result;
  return (
    <dialog ref={ref} className="compare" onClose={onClose} aria-labelledby="compare-title" data-testid="compare-dialog">
      {item && r && (
        <>
          <header className="compare-head">
            <h2 id="compare-title">Antes y después: {item.name}</h2>
            <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Cerrar comparación">
              ×
            </button>
          </header>
          <div className={`compare-stage${zoom ? ' is-zoom' : ''}`} style={{ aspectRatio: `${r.width} / ${r.height}` }}>
            {afterBroken || beforeBroken ? (
              <p className="compare-note">
                Tu navegador no puede mostrar {afterBroken ? FORMAT_LABEL[r.format] : 'el original'}, así que no hay vista previa. El archivo
                sí es válido y se puede descargar.
              </p>
            ) : (
              <>
                <img src={item.originalUrl} alt={`Original de ${item.name}`} className="compare-img" onError={() => setBeforeBroken(true)} />
                <img
                  src={r.url}
                  alt={`Resultado de ${item.name}`}
                  className="compare-img compare-after"
                  style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
                  onError={() => setAfterBroken(true)}
                />
                <div className="compare-handle" style={{ left: `${pos}%` }} aria-hidden="true" />
                <span className="compare-tag compare-tag-left">Original · {formatBytes(item.size)}</span>
                <span className="compare-tag compare-tag-right">
                  {FORMAT_LABEL[r.format]} · {formatBytes(r.size)}
                </span>
              </>
            )}
          </div>
          <div className="compare-controls">
            <label htmlFor="compare-range">Posición del corte</label>
            <input
              id="compare-range"
              type="range"
              min={0}
              max={100}
              value={pos}
              onChange={(e) => setPos(Number(e.target.value))}
              aria-valuetext={`${pos} % original a la izquierda`}
            />
            <label className="choice-inline">
              <input type="checkbox" checked={zoom} onChange={(e) => setZoom(e.target.checked)} /> Ver a tamaño real (100 %)
            </label>
          </div>
          {r.ssim !== undefined && (
            <p className="compare-note">
              Similitud medida (SSIM multiescala): {(r.ssim * 100).toFixed(1)} %. Es una medición, no una garantía de que no se note.
            </p>
          )}
        </>
      )}
    </dialog>
  );
}
