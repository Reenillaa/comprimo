import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Icon } from './effects';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/jxl,.jpg,.jpeg,.jfif,.png,.webp,.avif,.jxl';

interface Props {
  onFiles: (files: File[]) => void;
  compact: boolean;
  shortcut: string;
}

export interface DropZoneHandle {
  open(): void;
}

export const DropZone = forwardRef<DropZoneHandle, Props>(function DropZone({ onFiles, compact, shortcut }, ref) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  useImperativeHandle(ref, () => ({ open: () => input.current?.click() }), []);

  // Paste images from the clipboard anywhere on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) {
        e.preventDefault();
        onFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onFiles]);

  return (
    <section
      className={`dropzone${over ? ' is-over' : ''}${compact ? ' is-compact' : ' is-hero'}`}
      data-testid="dropzone"
      aria-label="Zona para soltar imágenes"
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        depth.current++;
        setOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(e) => {
        e.stopPropagation();
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        depth.current = 0;
        setOver(false);
        const files = [...e.dataTransfer.files];
        if (files.length) onFiles(files);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) input.current?.click();
      }}
    >
      {!compact && <div className="dropzone-glow" aria-hidden="true" />}
      <div className="dropzone-icon" aria-hidden="true">
        <Icon name={compact ? 'upload' : 'aperture'} size={compact ? 22 : 56} />
      </div>
      <div className="dropzone-text">
        <p className="dropzone-title">{over ? '¡Suéltalas!' : compact ? 'Añade más fotos' : 'Arrastra aquí las fotos de tu sesión'}</p>
        {!compact && (
          <p className="dropzone-sub">
            JPEG, PNG, WebP, AVIF y JPEG XL · sin límite de fotos · todo se queda en tu equipo
          </p>
        )}
      </div>
      <button type="button" id="add-photos" className="btn btn-primary" onClick={() => input.current?.click()}>
        <Icon name="upload" />
        Elegir imágenes
      </button>
      <p className="dropzone-hint">
        o pega con <kbd>{shortcut}</kbd>+<kbd>V</kbd>
      </p>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        className="visually-hidden"
        data-testid="file-input"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </section>
  );
});
