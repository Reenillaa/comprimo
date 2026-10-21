import { useEffect, useRef, useState } from 'react';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/jxl,.jpg,.jpeg,.jfif,.png,.webp,.avif,.jxl';

interface Props {
  onFiles: (files: File[]) => void;
  compact: boolean;
}

export function DropZone({ onFiles, compact }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const depth = useRef(0);

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
      className={`dropzone${over ? ' is-over' : ''}${compact ? ' is-compact' : ''}`}
      data-testid="dropzone"
      aria-label="Zona para soltar imágenes"
      onDragEnter={(e) => {
        e.preventDefault();
        depth.current++;
        setOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        const files = [...e.dataTransfer.files];
        if (files.length) onFiles(files);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) input.current?.click();
      }}
    >
      <svg className="dropzone-icon" viewBox="0 0 64 64" aria-hidden="true">
        <rect x="8" y="12" width="48" height="40" rx="6" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="24" cy="26" r="5" fill="currentColor" />
        <path d="M12 46l14-14 10 10 6-6 10 10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      <p className="dropzone-title">{over ? '¡Suelta para empezar!' : 'Arrastra aquí tus imágenes'}</p>
      <button type="button" className="btn btn-primary" onClick={() => input.current?.click()}>
        Elegir imágenes
      </button>
      <p className="dropzone-hint">
        JPEG, PNG, WebP, AVIF y JPEG XL · sin límite de archivos · también puedes pegar con <kbd>Ctrl</kbd>+<kbd>V</kbd>
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
}
