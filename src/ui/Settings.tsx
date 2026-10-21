import type { ReactNode } from 'react';
import { FORMAT_LABEL, type OutputFormat, type ProcessOptions, type Profile, type ResizeMode } from '../engine/types';

interface Props {
  options: ProcessOptions;
  onChange: (o: ProcessOptions) => void;
  onReset: () => void;
}

const PROFILES: { id: Profile; label: string; hint: string }[] = [
  { id: 'web', label: 'Web', hint: 'Recomendado: mucho ahorro sin pérdida visible' },
  { id: 'photo', label: 'Fotografía', hint: 'Más fidelidad, algo menos de ahorro' },
  { id: 'transparency', label: 'Transparencia', hint: 'Cuida bordes y degradados de alfa' },
  { id: 'graphics', label: 'Gráficos y texto', hint: 'Colores planos, logotipos, capturas' },
];

const OUTPUTS: { id: OutputFormat; label: string }[] = [
  { id: 'same', label: 'Mismo formato que el original' },
  { id: 'auto', label: 'Automático (el más ligero de JPEG/PNG, WebP y AVIF)' },
  { id: 'jpeg', label: 'JPEG' },
  { id: 'png', label: 'PNG' },
  { id: 'webp', label: 'WebP' },
  { id: 'avif', label: 'AVIF' },
  { id: 'jxl', label: 'JPEG XL (beta)' },
];

const RESIZE: { id: ResizeMode; label: string }[] = [
  { id: 'none', label: 'No redimensionar' },
  { id: 'fit', label: 'Encajar en ancho × alto máximos' },
  { id: 'scale', label: 'Escalar a un ancho o alto' },
  { id: 'cover', label: 'Rellenar ancho × alto (recorta al centro)' },
  { id: 'percent', label: 'Porcentaje' },
];

const num = (v: string) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

function Field({ label, children, hint, id }: { label: string; children: ReactNode; hint?: string; id: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function summarize(o: ProcessOptions): string {
  const parts: string[] = [];
  parts.push(o.output === 'same' ? 'Mismo formato' : o.output === 'auto' ? 'Formato automático' : `A ${FORMAT_LABEL[o.output]}`);
  parts.push(PROFILES.find((p) => p.id === o.profile)!.label);
  parts.push(o.quality === 'auto' ? 'Calidad automática' : `Calidad ${o.quality}`);
  if (o.resize.mode !== 'none') parts.push('Redimensionar');
  if (o.metadata.keep) parts.push('Con EXIF');
  return parts.join(' · ');
}

export function Settings({ options: o, onChange, onReset }: Props) {
  const set = (p: Partial<ProcessOptions>) => onChange({ ...o, ...p });
  const setResize = (p: Partial<ProcessOptions['resize']>) => set({ resize: { ...o.resize, ...p } });
  const scaleBy = o.resize.height && !o.resize.width ? 'height' : 'width';

  return (
    <details className="settings" data-testid="settings">
      <summary>
        <span className="settings-title">Ajustes</span>
        <span className="settings-summary">{summarize(o)}</span>
      </summary>
      <div className="settings-grid">
        <Field id="opt-output" label="Formato de salida">
          <select id="opt-output" value={o.output} onChange={(e) => set({ output: e.target.value as OutputFormat })}>
            {OUTPUTS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
          {o.output === 'jxl' && (
            <p className="field-note">
              JPEG XL ocupa poco, pero hoy solo lo muestran algunos navegadores (Safari, por ejemplo). Para la web, mejor AVIF o WebP.
            </p>
          )}
          {o.output === 'avif' && <p className="field-note">AVIF comprime mucho pero codifica más despacio.</p>}
          {o.output === 'jpeg' && <p className="field-note">JPEG no admite transparencia: se rellenará con el color de fondo.</p>}
        </Field>

        <fieldset className="field">
          <legend>Perfil</legend>
          <div className="choice-list">
            {PROFILES.map((p) => (
              <label key={p.id} className="choice">
                <input type="radio" name="profile" value={p.id} checked={o.profile === p.id} onChange={() => set({ profile: p.id })} />
                <span>
                  <strong>{p.label}</strong>
                  <small>{p.hint}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Calidad</legend>
          <div className="choice-row">
            <label className="choice-inline">
              <input type="radio" name="quality" checked={o.quality === 'auto'} onChange={() => set({ quality: 'auto' })} />
              Automática
            </label>
            <label className="choice-inline">
              <input type="radio" name="quality" checked={o.quality !== 'auto'} onChange={() => set({ quality: 75 })} />
              Manual
            </label>
          </div>
          {o.quality !== 'auto' && (
            <div className="range-row">
              <input
                id="opt-quality"
                type="range"
                min={1}
                max={100}
                value={o.quality}
                aria-label="Calidad manual"
                onChange={(e) => set({ quality: Number(e.target.value) })}
              />
              <output htmlFor="opt-quality">{o.quality}</output>
            </div>
          )}
          <p className="field-hint">
            {o.quality === 'auto'
              ? 'Busca, imagen a imagen, la calidad más baja que sigue pareciendo igual (medido con SSIM multiescala).'
              : 'En PNG, la calidad decide el número de colores (95 o más = sin pérdida).'}
          </p>
        </fieldset>

        <div className="field">
          <label htmlFor="opt-resize">Redimensionar</label>
          <select id="opt-resize" value={o.resize.mode} onChange={(e) => setResize({ mode: e.target.value as ResizeMode })}>
            {RESIZE.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          {(o.resize.mode === 'fit' || o.resize.mode === 'cover') && (
            <div className="dims">
              <label>
                Ancho
                <input type="number" min={1} inputMode="numeric" value={o.resize.width ?? ''} onChange={(e) => setResize({ width: num(e.target.value) })} />
              </label>
              <span aria-hidden="true">×</span>
              <label>
                Alto
                <input type="number" min={1} inputMode="numeric" value={o.resize.height ?? ''} onChange={(e) => setResize({ height: num(e.target.value) })} />
              </label>
              <span className="unit">px</span>
            </div>
          )}
          {o.resize.mode === 'scale' && (
            <div className="dims">
              <select
                aria-label="Dimensión"
                value={scaleBy}
                onChange={(e) => {
                  const v = o.resize.width ?? o.resize.height;
                  setResize(e.target.value === 'width' ? { width: v, height: undefined } : { height: v, width: undefined });
                }}
              >
                <option value="width">Ancho</option>
                <option value="height">Alto</option>
              </select>
              <input
                type="number"
                min={1}
                aria-label="Píxeles"
                value={(scaleBy === 'width' ? o.resize.width : o.resize.height) ?? ''}
                onChange={(e) => setResize(scaleBy === 'width' ? { width: num(e.target.value), height: undefined } : { height: num(e.target.value), width: undefined })}
              />
              <span className="unit">px</span>
            </div>
          )}
          {o.resize.mode === 'percent' && (
            <div className="dims">
              <input type="number" min={1} max={100} aria-label="Porcentaje" value={o.resize.percent ?? 50} onChange={(e) => setResize({ percent: num(e.target.value) })} />
              <span className="unit">%</span>
            </div>
          )}
          {o.resize.mode !== 'none' && <p className="field-hint">Mantiene la proporción y nunca amplía la imagen.</p>}
        </div>

        <fieldset className="field">
          <legend>Metadatos</legend>
          <label className="choice-inline">
            <input type="checkbox" checked={o.metadata.keep} onChange={(e) => set({ metadata: { ...o.metadata, keep: e.target.checked } })} />
            Conservar EXIF (fecha, cámara, copyright)
          </label>
          <label className={`choice-inline${o.metadata.keep ? '' : ' is-disabled'}`}>
            <input
              type="checkbox"
              disabled={!o.metadata.keep}
              checked={o.metadata.keep && o.metadata.keepLocation}
              onChange={(e) => set({ metadata: { ...o.metadata, keepLocation: e.target.checked } })}
            />
            Incluir ubicación GPS
          </label>
          <p className="field-hint">
            Por defecto se eliminan: pesan y pueden revelar dónde se hizo la foto. El EXIF solo se conserva de JPEG a JPEG; el
            perfil de color se convierte a sRGB.
          </p>
        </fieldset>

        <div className="field">
          <label htmlFor="opt-bg">Fondo al quitar transparencia</label>
          <input id="opt-bg" type="color" value={o.background} onChange={(e) => set({ background: e.target.value })} />
          <label className="choice-inline">
            <input type="checkbox" checked={o.keepOriginalIfLarger} onChange={(e) => set({ keepOriginalIfLarger: e.target.checked })} />
            Si no se puede reducir, conservar el original
          </label>
        </div>
      </div>
      <div className="settings-actions">
        <button type="button" className="btn btn-ghost" onClick={onReset}>
          Restablecer ajustes
        </button>
      </div>
    </details>
  );
}
