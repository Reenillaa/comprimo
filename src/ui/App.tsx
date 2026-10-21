import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { desktop } from '../app/desktop';
import { useCompressor, type Item, type ItemResult } from '../app/useCompressor';
import { CompareDialog } from './CompareDialog';
import { DropZone, type DropZoneHandle } from './DropZone';
import { Aurora, Confetti, Icon } from './effects';
import { Gallery } from './Gallery';
import { Destination, PresetPicker, SessionPanel, Toasts, type Toast } from './Panels';
import { matchPreset } from './presets';
import { Settings, summarize } from './Settings';
import { StatsBar } from './StatsBar';
import { usePersistent, useSettings } from './useSettings';

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent);
const MOD = isMac ? '⌘' : 'Ctrl';

export function App() {
  const [options, setOptions] = useSettings();
  const [suffix, setSuffix] = usePersistent('comprimo:suffix', '');
  const [theme, setTheme] = usePersistent<'dark' | 'light'>('comprimo:theme', 'dark');
  const [view, setView] = usePersistent<'grid' | 'list'>('comprimo:view', 'grid');
  const [outputDir, setOutputDir] = useState<string>();
  const [watchDir, setWatchDir] = useState<string>();
  const [sessionLive, setSessionLive] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [sessionError, setSessionError] = useState<string>();
  const [compareId, setCompareId] = useState<string>();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dragging, setDragging] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const dropRef = useRef<DropZoneHandle>(null);
  const headlineRef = useRef<HTMLParagraphElement>(null);
  const outputRef = useRef(outputDir);
  outputRef.current = outputDir;

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const onDone = useCallback(async (_item: Item, result: ItemResult) => {
    const dir = outputRef.current;
    if (!desktop || !dir) return;
    return desktop.save(dir, result.name, new Uint8Array(await result.blob.arrayBuffer()));
  }, []);

  const c = useCompressor(options, { suffix, onDone });
  const { addFiles } = c;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.documentElement.classList.toggle('is-desktop', !!desktop);
    document.documentElement.classList.toggle('is-mac', isMac);
  }, []);

  const busy = c.items.filter((i) => ['checking', 'queued', 'processing'].includes(i.status)).length;
  const done = c.items.filter((i) => i.status === 'done').length;
  const errors = c.items.filter((i) => i.status === 'error').length;

  // Batch finished: confetti, OS notification, clear dock/taskbar progress.
  const prevBusy = useRef(0);
  useEffect(() => {
    if (prevBusy.current > 0 && busy === 0 && done > 0) {
      setConfetti((n) => n + 1);
      desktop?.notify('Comprimo', `${done} ${done === 1 ? 'foto lista' : 'fotos listas'}${errors ? ` · ${errors} con error` : ''}`);
    }
    prevBusy.current = busy;
  }, [busy, done, errors]);
  useEffect(() => {
    if (!desktop) return;
    if (!busy) return desktop.progress(-1);
    const overall = c.items.reduce((s, i) => s + (['checking', 'queued', 'processing'].includes(i.status) ? i.progress : 1), 0) / c.items.length;
    desktop.progress(overall);
  }, [c.items, busy]);

  const announcement = useMemo(() => {
    if (!c.items.length) return '';
    return busy
      ? `Procesando: ${done} de ${c.items.length} imágenes terminadas.`
      : `Listo: ${done} imágenes optimizadas${errors ? `, ${errors} con error` : ''}.`;
  }, [c.items.length, busy, done, errors]);

  const pickOutput = useCallback(async () => {
    const dir = await desktop?.pickFolder('output');
    if (dir) {
      setOutputDir(dir);
      toast('Las fotos se guardarán en esa carpeta', 'good');
    }
  }, [toast]);

  // Session mode: new files in the watched folder flow straight into the queue.
  const addFromPath = useCallback(
    async (file: string) => {
      if (!desktop) return;
      try {
        const f = await desktop.read(file);
        addFiles([new File([f.bytes as Uint8Array<ArrayBuffer>], f.name, { lastModified: f.lastModified })], 'session');
        setSessionCount((n) => n + 1);
        toast(`Nueva foto: ${f.name}`);
      } catch (e) {
        toast(`No se pudo leer ${file}: ${(e as Error).message}`, 'bad');
      }
    },
    [addFiles, toast],
  );
  useEffect(() => {
    if (!desktop || !sessionLive) return;
    const off1 = desktop.onWatchFile(addFromPath);
    const off2 = desktop.onWatchError((m) => {
      setSessionError(m);
      setSessionLive(false);
    });
    return () => {
      off1();
      off2();
    };
  }, [sessionLive, addFromPath]);

  const toggleSession = async () => {
    if (!desktop || !watchDir) return;
    if (sessionLive) {
      await desktop.unwatch();
      setSessionLive(false);
      toast('Sesión detenida');
      return;
    }
    try {
      setSessionError(undefined);
      await desktop.watch(watchDir, outputDir);
      setSessionCount(0);
      setSessionLive(true);
      toast('Sesión en directo: esperando fotos nuevas…', 'good');
    } catch (e) {
      setSessionError((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    }
  };

  const importExisting = async () => {
    if (!desktop || !watchDir) return;
    const files = await desktop.list(watchDir);
    if (!files.length) return toast('No hay fotos en esa carpeta');
    for (const f of files) await addFromPath(f);
  };

  // Menu (desktop) and keyboard shortcuts.
  useEffect(() => {
    const off = desktop?.onMenu((cmd) => (cmd === 'open' ? dropRef.current?.open() : pickOutput()));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o' && !desktop) {
        e.preventDefault();
        dropRef.current?.open();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      off?.();
      window.removeEventListener('keydown', onKey);
    };
  }, [pickOutput]);

  // Whole-window drop target.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setDragging(true);
    };
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      depth = 0;
      setDragging(false);
      if (e.defaultPrevented || !e.dataTransfer?.files.length) return;
      e.preventDefault();
      addFiles([...e.dataTransfer.files]);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [addFiles]);

  const activePreset = matchPreset(options, suffix);

  return (
    <div className="app">
      <a
        className="skip-link"
        href="#add-photos"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('add-photos')?.focus();
        }}
      >
        Ir a añadir fotos
      </a>
      <Aurora />
      <header className="titlebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="aperture" size={20} />
          </span>
          <span className="brand-name">Comprimo</span>
          <span className="brand-tag">para fotógrafos</span>
        </div>
        <div className="titlebar-center">
          {busy > 0 ? (
            <span className="pill pill-busy">
              <span className="spinner" aria-hidden="true" /> {busy} en curso
            </span>
          ) : sessionLive ? (
            <span className="pill pill-live">
              <span className="live-dot" aria-hidden="true" /> Sesión en directo
            </span>
          ) : (
            <span className="pill">Gratis · sin límites · 100 % local</span>
          )}
        </div>
        <button
          type="button"
          className="btn btn-icon titlebar-btn"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          title="Tema"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
        </button>
      </header>

      <div className="layout">
        <aside className="sidebar" aria-label="Ajustes">
          <section className="panel">
            <h2>Preajuste</h2>
            <PresetPicker
              active={activePreset}
              onPick={(p) => {
                setOptions(p.options);
                setSuffix(p.suffix);
              }}
            />
          </section>
          <section className="panel">
            <h2>
              Ajustes <span className="panel-sub">{summarize(options)}</span>
            </h2>
            <Settings options={options} onChange={setOptions} />
          </section>
          <section className="panel">
            <h2>Destino</h2>
            <Destination desktop={!!desktop} outputDir={outputDir} suffix={suffix} onSuffix={setSuffix} onPickOutput={pickOutput} onClearOutput={() => setOutputDir(undefined)} />
          </section>
          {desktop && (
            <section className={`panel panel-session${sessionLive ? ' is-live' : ''}`}>
              <h2>Modo sesión</h2>
              <SessionPanel
                watchDir={watchDir}
                active={sessionLive}
                received={sessionCount}
                outputDir={outputDir}
                error={sessionError}
                onPick={async () => {
                  const d = await desktop!.pickFolder('watch');
                  if (d) setWatchDir(d);
                }}
                onToggle={toggleSession}
                onImportExisting={importExisting}
              />
            </section>
          )}
          <p className="privacy">
            <Icon name="check" size={14} /> Tus fotos no salen de este equipo. Sin cuentas, sin pagos y sin marcas de agua.
          </p>
        </aside>

        <main id="main" className="workspace">
          {c.items.length === 0 && (
            <div className="hero">
              <h1>
                Fotos ligeras, <span className="grad-text">calidad intacta</span>
              </h1>
              <p className="lead">Comprime y exporta tu sesión en segundos con códecs profesionales (MozJPEG, AVIF, WebP, JPEG XL) que funcionan en tu propio equipo.</p>
            </div>
          )}
          <DropZone ref={dropRef} onFiles={c.addFiles} compact={c.items.length > 0} shortcut={MOD} />
          {c.items.length > 0 && (
            <>
              <StatsBar
                ref={headlineRef}
                items={c.items}
                view={view}
                onView={setView}
                onCancelAll={c.cancelAll}
                onReprocess={c.reprocessAll}
                onClear={c.clear}
                outputDir={outputDir}
                onOpenOutput={outputDir ? () => desktop?.openFolder(outputDir) : undefined}
              />
              <Gallery
                items={c.items}
                view={view}
                canReveal={!!desktop}
                onCancel={c.cancel}
                onRetry={(id) => c.retry(id)}
                onRemove={c.remove}
                onCompare={setCompareId}
                onProcessDuplicate={c.processDuplicate}
                onReveal={(p) => desktop?.reveal(p)}
              />
            </>
          )}
          {c.items.length === 0 && (
            <ul className="features" aria-label="Qué hace">
              <li>
                <Icon name="sparkle" size={20} />
                <strong>Calidad medida</strong>
                <span>Cada foto recibe la compresión justa, medida con SSIM.</span>
              </li>
              <li>
                <Icon name="camera" size={20} />
                <strong>Modo sesión</strong>
                <span>{desktop ? 'Vigila la carpeta de la cámara y optimiza al vuelo.' : 'En la app de escritorio: optimiza según disparas.'}</span>
              </li>
              <li>
                <Icon name="eye" size={20} />
                <strong>Antes y después</strong>
                <span>Compara con un deslizador y zoom al 100 %.</span>
              </li>
            </ul>
          )}
        </main>
      </div>

      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-overlay-inner">
            <Icon name="upload" size={48} />
            <p>Suelta para optimizar</p>
          </div>
        </div>
      )}
      <div className="visually-hidden" aria-live="polite" data-testid="live-region">
        {announcement}
      </div>
      <Toasts toasts={toasts} />
      <Confetti fire={confetti} originRef={headlineRef} />
      <CompareDialog item={c.items.find((i) => i.id === compareId)} onClose={() => setCompareId(undefined)} />
    </div>
  );
}
