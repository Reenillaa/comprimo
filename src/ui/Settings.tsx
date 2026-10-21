import { FORMAT_LABEL, type OutputFormat, type ProcessOptions, type Profile, type ResizeMode } from '../engine/types';

interface Props {
  options: ProcessOptions;
  onChange: (o: ProcessOptions) => void;
}

const PROFILES: { id: Profile; label: string; hint: string }[] = [
  { id: 'web', label: 'Web', hint: 'Mucho ahorro sin pérdida visible' },
  { id: 'photo', label: 'Foto', hint: 'Más fidelidad, algo menos de ahorro' },
  { id: 'transparency', label: 'Alfa', hint: 'Cuida bordes y degradados transparentes' },
  { id: 'graphics', label: 'Gráficos', hint: 'Colores planos, logotipos, capturas' },
];

const OUTPUTS: { id: OutputFormat; label: string }[] = [
  { id: 'same', label: 'Mismo formato que el original' },
  { id: 'auto', label: 'Automático (el más ligero)' },
  { id: 'jpeg', label: 'JPEG' },
  { id: 'png', label: 'PNG' },
  { id: 'webp', label: 'WebP' },
  { id: 'avif', label: 'AVIF' },
  { id: 'jxl', label: 'JPEG XL (beta)' },
];

const RESIZE: { id: ResizeMode; label: string }[] = [
  { id: 'none', label: 'Tamaño original' },
  { id: 'fit', label: 'Encajar en ancho × alto' },
  { id: 'scale', label: 'Escalar a un ancho o alto' },
  { id: 'cover', label: 'Rellenar (recorte centrado)' },
  { id: 'percent', label: 'Porcentaje' },
];

const num = (v: string) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export function summarize(o: ProcessOptions): string {
  const parts: string[] = [];
  parts.push(o.output === 'same' ? 'Mismo formato' : o.output === 'auto' ? 'Formato automático' : FORMAT_LABEL[o.output]);
  parts.push(PROFILES.find((p) => p.id === o.profile)!.label);
  parts.push(o.quality === 'auto' ? 'Calidad auto' : `Calidad ${o.quality}`);
  if (o.resize.mode === 'fit' && o.resize.width) parts.push(`${o.resize.width} px`);
  return parts.join(' · ');
}

export function Settings({ options: o, onChange }: Props) {
  const set = (p: Partial<ProcessOptions>) => onChange({ ...o, ...p });
  const setResize = (p: Partial<ProcessOptions['resize']>) => set({ resize: { ...o.resize, ...p } });
  const scaleBy = o.resize.height && !o.resize.width ? 'height' : 'width';
  const profileHint = PROFILES.find((p) => p.id === o.profile)!.hint;

  return (
    <div className="settings" data-testid="settings">
      <div className="field">
        <label htmlFor="opt-output">Formato de salida</label>
        <select id="opt-output" value={o.output} onChange={(e) => set({ output: e.target.value as OutputFormat })}>
          {OUTPUTS.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
        {o.output === 'jxl' && <p className="note">JPEG XL pesa poco pero aún no lo abren todos los navegadores (Safari sí).</p>}
        {o.output === 'avif' && <p className="note">AVIF comprime muchísimo, pero codifica más despacio.</p>}
        {o.output === 'jpeg' && <p className="note">JPEG no admite transparencia: se rellena con el color de fondo.</p>}
      </div>

      <fieldset className="field">
        <legend>Perfil</legend>
        <div className="segmented" role="radiogroup" aria-label="Perfil">
          {PROFILES.map((p) => (
            <label key={p.id} className="segment" title={p.hint}>
              <input type="radio" name="profile" value={p.id} checked={o.profile === p.id} onChange={() => set({ profile: p.id })} />
              <span>{p.label}</span>
            </label>
          ))}
        </div>
        <p className="hint">{profileHint}</p>
      </fieldset>

      <fieldset className="field">
        <legend>Calidad</legend>
        <div className="segmented" role="radiogroup" aria-label="Calidad">
          <label className="segment">
            <input type="radio" name="quality" checked={o.quality === 'auto'} onChange={() => set({ quality: 'auto' })} />
            <span>Automática</span>
          </label>
          <label className="segment">
            <input type="radio" name="quality" checked={o.quality !== 'auto'} onChange={() => set({ quality: 75 })} />
            <span>Manual</span>
          </label>
        </div>
        {o.quality !== 'auto' && (
          <div className="range-row">
            <input id="opt-quality" type="range" min={1} max={100} value={o.quality} aria-label="Calidad manual" onChange={(e) => set({ quality: Number(e.target.value) })} />
            <output htmlFor="opt-quality">{o.quality}</output>
          </div>
        )}
        <p className="hint">
          {o.quality === 'auto'
            ? 'Busca en cada foto la calidad más baja que sigue pareciendo idéntica (SSIM multiescala).'
            : 'En PNG la calidad decide los colores (95 o más = sin pérdida).'}
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
        {o.resize.mode !== 'none' && <p className="hint">Mantiene la proporción y nunca amplía.</p>}
      </div>

      <fieldset className="field">
        <legend>Metadatos</legend>
        <label className="toggle">
          <input type="checkbox" role="switch" checked={o.metadata.keep} onChange={(e) => set({ metadata: { ...o.metadata, keep: e.target.checked } })} />
          <span className="toggle-track" aria-hidden="true" />
          Conservar EXIF (cámara, fecha, copyright)
        </label>
        <label className={`toggle${o.metadata.keep ? '' : ' is-disabled'}`}>
          <input
            type="checkbox"
            role="switch"
            disabled={!o.metadata.keep}
            checked={o.metadata.keep && o.metadata.keepLocation}
            onChange={(e) => set({ metadata: { ...o.metadata, keepLocation: e.target.checked } })}
          />
          <span className="toggle-track" aria-hidden="true" />
          Incluir ubicación GPS
        </label>
        <p className="hint">El EXIF solo se conserva de JPEG a JPEG; el color se convierte a sRGB.</p>
      </fieldset>

      <fieldset className="field">
        <legend>Extras</legend>
        <label className="toggle">
          <input type="checkbox" role="switch" checked={o.keepOriginalIfLarger} onChange={(e) => set({ keepOriginalIfLarger: e.target.checked })} />
          <span className="toggle-track" aria-hidden="true" />
          Si no se puede reducir, conservar el original
        </label>
        <div className="color-row">
          <label htmlFor="opt-bg">Fondo al quitar transparencia</label>
          <input id="opt-bg" type="color" value={o.background} onChange={(e) => set({ background: e.target.value })} />
        </div>
      </fieldset>
    </div>
  );
}
