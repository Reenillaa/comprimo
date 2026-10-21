import { useMemo, useState } from 'react';
import { DEFAULT_OPTIONS } from '../engine/types';
import { useCompressor } from '../app/useCompressor';
import { CompareDialog } from './CompareDialog';
import { DropZone } from './DropZone';
import { FileList } from './FileList';
import { Settings } from './Settings';
import { Summary } from './Summary';
import { useSettings } from './useSettings';

export function App() {
  const [options, setOptions] = useSettings();
  const c = useCompressor(options);
  const [compareId, setCompareId] = useState<string>();

  const announcement = useMemo(() => {
    if (!c.items.length) return '';
    const done = c.items.filter((i) => i.status === 'done').length;
    const errors = c.items.filter((i) => i.status === 'error').length;
    const busy = c.items.filter((i) => ['checking', 'queued', 'processing'].includes(i.status)).length;
    return busy
      ? `Procesando: ${done} de ${c.items.length} imágenes terminadas.`
      : `Listo: ${done} imágenes optimizadas${errors ? `, ${errors} con error` : ''}.`;
  }, [c.items]);

  return (
    <div className="page">
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <header className="site-header">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
            <rect x="4" y="4" width="32" height="32" rx="9" fill="var(--accent)" />
            <path d="M12 14h16M14 20h12M17 26h6" stroke="var(--on-accent)" strokeWidth="3.2" strokeLinecap="round" />
          </svg>
          <span className="brand-name">Comprimo</span>
        </div>
        <p className="brand-tag">Gratis · sin límites · 100 % en tu navegador</p>
      </header>

      <main id="main">
        <section className="hero">
          <h1>Reduce el peso de tus imágenes sin que se note</h1>
          <p className="lead">
            Compresión inteligente de JPEG, PNG, WebP, AVIF y JPEG XL. Tus fotos no salen de tu dispositivo: todo se procesa aquí, en
            tu navegador.
          </p>
        </section>

        <div className="workspace">
          <DropZone onFiles={c.addFiles} compact={c.items.length > 0} />
          <Settings options={options} onChange={setOptions} onReset={() => setOptions(DEFAULT_OPTIONS)} />

          {c.items.length > 0 && (
            <>
              <FileList
                items={c.items}
                onCancel={c.cancel}
                onRetry={(id) => c.retry(id)}
                onRemove={c.remove}
                onCompare={setCompareId}
                onProcessDuplicate={c.processDuplicate}
              />
              <Summary items={c.items} onCancelAll={c.cancelAll} onReprocess={c.reprocessAll} onClear={c.clear} />
            </>
          )}
        </div>

        <section className="facts" aria-label="Cómo funciona">
          <div>
            <h2>Privado de verdad</h2>
            <p>Las imágenes se procesan con códecs WebAssembly en tu equipo. No se suben a ningún servidor ni se guardan.</p>
          </div>
          <div>
            <h2>Calidad medida, no adivinada</h2>
            <p>
              Para cada imagen se busca la calidad más baja que sigue pareciendo igual al original, con una métrica objetiva (SSIM
              multiescala). Los PNG se reducen a paleta cuando no se nota.
            </p>
          </div>
          <div>
            <h2>Sin trampas</h2>
            <p>Sin cuentas, sin planes de pago, sin marcas de agua y sin límite de imágenes ni de tamaño artificial.</p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <p>
          Comprimo es software libre (MIT). Usa MozJPEG, libwebp, libavif, libjxl y OxiPNG vía jSquash (Apache-2.0), y fflate (MIT).
          No está afiliado con TinyPNG ni con Tinify.
        </p>
      </footer>

      <div className="visually-hidden" aria-live="polite" data-testid="live-region">
        {announcement}
      </div>
      <CompareDialog item={c.items.find((i) => i.id === compareId)} onClose={() => setCompareId(undefined)} />
    </div>
  );
}
