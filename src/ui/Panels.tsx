import { useEffect, useState } from 'react';
import { folderName } from '../app/desktop';
import { Icon } from './effects';
import { PRESETS, type Preset } from './presets';

export function PresetPicker({ active, onPick }: { active?: string; onPick: (p: Preset) => void }) {
  return (
    <div className="presets" role="radiogroup" aria-label="Preajustes">
      {PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={active === p.id}
          className={`preset${active === p.id ? ' is-active' : ''}`}
          onClick={() => onPick(p)}
          title={p.hint}
          data-testid={`preset-${p.id}`}
        >
          <span className="preset-icon">
            <Icon name={p.icon} size={18} />
          </span>
          <span className="preset-text">
            <strong>{p.label}</strong>
            <small>{p.hint}</small>
          </span>
        </button>
      ))}
      {!active && <p className="hint">Ajustes personalizados.</p>}
    </div>
  );
}

interface DestinationProps {
  desktop: boolean;
  outputDir?: string;
  suffix: string;
  onSuffix: (s: string) => void;
  onPickOutput: () => void;
  onClearOutput: () => void;
}

export function Destination({ desktop, outputDir, suffix, onSuffix, onPickOutput, onClearOutput }: DestinationProps) {
  return (
    <div className="destination">
      {desktop ? (
        outputDir ? (
          <div className="folder-pill" title={outputDir}>
            <Icon name="folder" size={16} />
            <span className="folder-name">{folderName(outputDir)}</span>
            <button type="button" className="link" onClick={onPickOutput}>
              Cambiar
            </button>
            <button type="button" className="link" onClick={onClearOutput} aria-label="Dejar de guardar en carpeta">
              <Icon name="close" size={14} />
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost btn-block" onClick={onPickOutput} data-testid="pick-output">
            <Icon name="folder" size={16} /> Guardar automáticamente en una carpeta…
          </button>
        )
      ) : (
        <p className="hint">Las fotos se descargan con el navegador, una a una o en un ZIP.</p>
      )}
      {desktop && outputDir && <p className="hint">Cada foto se guarda al terminar. Nunca se sobrescribe nada: si el nombre existe, se añade (2), (3)…</p>}
      <div className="field">
        <label htmlFor="opt-suffix">Sufijo del nombre</label>
        <input id="opt-suffix" type="text" value={suffix} placeholder="p. ej. _web" maxLength={40} onChange={(e) => onSuffix(e.target.value)} />
        <p className="hint">{`IMG_0042${suffix || ''}.jpg`}</p>
      </div>
    </div>
  );
}

interface SessionProps {
  watchDir?: string;
  active: boolean;
  received: number;
  outputDir?: string;
  error?: string;
  onPick: () => void;
  onToggle: () => void;
  onImportExisting: () => void;
}

/** "Modo sesión": watch the camera/tethering folder and optimise every new photo as it lands. */
export function SessionPanel({ watchDir, active, received, outputDir, error, onPick, onToggle, onImportExisting }: SessionProps) {
  const [pulse, setPulse] = useState(0);
  useEffect(() => setPulse((p) => p + 1), [received]);
  return (
    <div className={`session${active ? ' is-live' : ''}`}>
      <p className="hint">
        Vigila la carpeta donde caen las fotos (tethering de Lightroom/Capture One, importación de la tarjeta…) y optimiza cada foto nueva al momento.
      </p>
      {watchDir ? (
        <div className="folder-pill" title={watchDir}>
          <Icon name="camera" size={16} />
          <span className="folder-name">{folderName(watchDir)}</span>
          {!active && (
            <button type="button" className="link" onClick={onPick}>
              Cambiar
            </button>
          )}
        </div>
      ) : (
        <button type="button" className="btn btn-ghost btn-block" onClick={onPick} data-testid="pick-watch">
          <Icon name="camera" size={16} /> Elegir carpeta de la cámara…
        </button>
      )}
      {watchDir && (
        <button type="button" className={`btn btn-block ${active ? 'btn-live' : 'btn-primary'}`} onClick={onToggle} data-testid="session-toggle">
          {active ? (
            <>
              <span className="live-dot" key={pulse} aria-hidden="true" /> En directo · {received} {received === 1 ? 'foto' : 'fotos'} · Detener
            </>
          ) : (
            <>
              <Icon name="sparkle" size={16} /> Empezar sesión
            </>
          )}
        </button>
      )}
      {watchDir && !active && (
        <button type="button" className="link" onClick={onImportExisting}>
          Procesar también las fotos que ya hay
        </button>
      )}
      {active && !outputDir && <p className="note">Consejo: elige una carpeta de salida para guardar cada foto sin tocar nada más.</p>}
      {error && <p className="card-error">{error}</p>}
    </div>
  );
}

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad';
}

export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          <Icon name={t.tone === 'bad' ? 'alert' : t.tone === 'good' ? 'check' : 'camera'} size={16} />
          {t.text}
        </div>
      ))}
    </div>
  );
}
