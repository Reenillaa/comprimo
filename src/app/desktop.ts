/** Bridge exposed by electron/preload.cjs. Undefined in the web version. */
export interface DesktopBridge {
  pickFolder(purpose: 'output' | 'watch'): Promise<string | null>;
  save(dir: string, name: string, bytes: Uint8Array): Promise<string>;
  read(file: string): Promise<{ name: string; bytes: Uint8Array; lastModified: number }>;
  list(dir: string): Promise<string[]>;
  watch(dir: string, outDir?: string): Promise<boolean>;
  unwatch(): Promise<boolean>;
  reveal(file: string): Promise<void>;
  openFolder(dir: string): Promise<void>;
  progress(fraction: number): void;
  notify(title: string, body: string): void;
  info(): Promise<{ version: string; platform: string }>;
  onWatchFile(cb: (file: string) => void): () => void;
  onWatchError(cb: (msg: string) => void): () => void;
  onMenu(cb: (cmd: 'open' | 'output') => void): () => void;
}

export const desktop: DesktopBridge | undefined = (globalThis as { comprimoDesktop?: DesktopBridge }).comprimoDesktop;

export const isDesktop = !!desktop;

export function folderName(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? p;
}
