// Comprimo desktop shell (Electron main process).
// The UI is the same static build as the web version, served from a private app:// scheme.
// The renderer has no Node access: it talks to this process only through the small, validated
// IPC surface exposed by preload.cjs. File system access is limited to folders the user picked.
const { app, BrowserWindow, dialog, ipcMain, Menu, Notification, protocol, shell, net, nativeTheme } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const IS_MAC = process.platform === 'darwin';
const SCHEME = 'app';
const HOST = 'comprimo';
const DIST = path.join(__dirname, '..', 'dist');
const IMAGE_EXT = /\.(jpe?g|jfif|png|webp|avif|jxl)$/i;
const MAX_READ = 512 * 1024 * 1024; // 512 MB per file: generous but bounded

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

// Automated tests run each launch with a throwaway profile.
if (process.env.COMPRIMO_USER_DATA) app.setPath('userData', process.env.COMPRIMO_USER_DATA);

if (!app.requestSingleInstanceLock()) app.quit();

/** Folders the user explicitly chose in a dialog this session. Nothing else is readable/writable. */
const allowedDirs = new Set();
const isInside = (dir, p) => {
  const rel = path.relative(dir, p);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};
const allowed = (p) => [...allowedDirs].some((d) => isInside(d, path.resolve(p)));

let win;
let watcher = null;

function createWindow() {
  nativeTheme.themeSource = 'dark';
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: IS_MAC ? '#00000000' : '#0b0c10',
    title: 'Comprimo',
    icon: path.join(__dirname, 'icon.png'),
    // macOS: native traffic lights inset in our own title bar. Windows/Linux: overlay controls.
    ...(IS_MAC
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 15 }, vibrancy: 'under-window', visualEffectState: 'active' }
      : { titleBarStyle: 'hidden', titleBarOverlay: { color: '#00000000', symbolColor: '#e7e9ee', height: 44 } }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  // No navigation away from the app, no pop-ups.
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`${SCHEME}://${HOST}/`)) e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.loadURL(process.env.COMPRIMO_DEV_URL || `${SCHEME}://${HOST}/index.html`);
}

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

function buildMenu() {
  // Without an application menu, ⌘C/⌘V/⌘A/⌘Q do not work on macOS.
  const template = [
    ...(IS_MAC ? [{ role: 'appMenu' }] : []),
    {
      label: 'Archivo',
      submenu: [
        { label: 'Añadir fotos…', accelerator: 'CmdOrCtrl+O', click: () => win?.webContents.send('comprimo:menu', 'open') },
        { label: 'Elegir carpeta de salida…', accelerator: 'CmdOrCtrl+Shift+O', click: () => win?.webContents.send('comprimo:menu', 'output') },
        { type: 'separator' },
        IS_MAC ? { role: 'close', label: 'Cerrar ventana' } : { role: 'quit', label: 'Salir' },
      ],
    },
    { role: 'editMenu', label: 'Edición' },
    { role: 'viewMenu', label: 'Ver' },
    { role: 'windowMenu', label: 'Ventana' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  // Deny every permission request (camera, geolocation, notifications via web API…).
  require('electron').session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));

  protocol.handle(SCHEME, async (req) => {
    const url = new URL(req.url);
    if (url.host !== HOST) return new Response('Not found', { status: 404 });
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(DIST, rel));
    if (!isInside(DIST, file)) return new Response('Forbidden', { status: 403 });
    const res = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(res.headers);
    if (file.endsWith('.wasm')) headers.set('Content-Type', 'application/wasm');
    if (file.endsWith('.js') || file.endsWith('.mjs')) headers.set('Content-Type', 'text/javascript');
    return new Response(res.body, { status: res.status, headers });
  });

  createWindow();
});

app.on('window-all-closed', () => {
  watcher?.close();
  watcher = null;
  if (!IS_MAC) app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ---------- IPC ----------

ipcMain.handle('comprimo:pick-folder', async (_e, purpose) => {
  // Automated tests only: native dialogs cannot be driven, so a pre-chosen folder is used.
  const forced = process.env[purpose === 'watch' ? 'COMPRIMO_E2E_WATCH_DIR' : 'COMPRIMO_E2E_OUTPUT_DIR'];
  if (forced) {
    const dir = path.resolve(forced);
    allowedDirs.add(dir);
    return dir;
  }
  const r = await dialog.showOpenDialog(win, {
    title: purpose === 'watch' ? 'Carpeta a vigilar (cámara, tarjeta, tethering)' : 'Carpeta donde guardar las imágenes optimizadas',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const dir = path.resolve(r.filePaths[0]);
  allowedDirs.add(dir);
  return dir;
});

/** Write a file into an allowed folder without ever overwriting: "foto.jpg" → "foto (2).jpg". */
ipcMain.handle('comprimo:save', async (_e, dir, name, bytes) => {
  if (typeof dir !== 'string' || !allowed(dir)) throw new Error('Carpeta no autorizada.');
  const safe = path.basename(String(name)).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_') || 'imagen';
  const ext = path.extname(safe);
  const base = safe.slice(0, safe.length - ext.length);
  await fsp.mkdir(dir, { recursive: true });
  for (let n = 1; n < 10000; n++) {
    const candidate = path.join(dir, n === 1 ? safe : `${base} (${n})${ext}`);
    try {
      await fsp.writeFile(candidate, Buffer.from(bytes), { flag: 'wx' });
      return candidate;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }
  throw new Error('Demasiados archivos con el mismo nombre.');
});

ipcMain.handle('comprimo:read', async (_e, file) => {
  if (typeof file !== 'string' || !allowed(file)) throw new Error('Archivo no autorizado.');
  const st = await fsp.stat(file);
  if (st.size > MAX_READ) throw new Error('Archivo demasiado grande.');
  const data = await fsp.readFile(file);
  return { name: path.basename(file), bytes: new Uint8Array(data.buffer, data.byteOffset, data.byteLength), lastModified: st.mtimeMs };
});

ipcMain.handle('comprimo:list', async (_e, dir) => {
  if (typeof dir !== 'string' || !allowed(dir)) throw new Error('Carpeta no autorizada.');
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isFile() && IMAGE_EXT.test(e.name)).map((e) => path.join(dir, e.name));
});

/**
 * Watch a folder for new photos. A file is reported once its size has been stable for
 * 1.2 s, so cameras and tethering software that write progressively are handled.
 */
ipcMain.handle('comprimo:watch', async (_e, dir, outDir) => {
  if (typeof dir !== 'string' || !allowed(dir)) throw new Error('Carpeta no autorizada.');
  if (outDir && (isInside(dir, outDir) || isInside(outDir, dir))) {
    throw new Error('La carpeta de salida no puede estar dentro de la carpeta vigilada (ni al revés): se procesarían sus propios resultados.');
  }
  watcher?.close();
  const pending = new Map();
  const seen = new Set();
  const check = (file) => {
    clearTimeout(pending.get(file)?.timer);
    const timer = setTimeout(async () => {
      try {
        const st = await fsp.stat(file);
        const prev = pending.get(file)?.size;
        if (prev !== st.size || st.size === 0) {
          pending.set(file, { size: st.size, timer: null });
          return check(file);
        }
        pending.delete(file);
        if (seen.has(file)) return;
        seen.add(file);
        win?.webContents.send('comprimo:watch-file', file);
      } catch {
        pending.delete(file);
      }
    }, 1200);
    pending.set(file, { size: pending.get(file)?.size, timer });
  };
  watcher = fs.watch(dir, { recursive: false }, (_ev, name) => {
    if (!name || !IMAGE_EXT.test(name)) return;
    check(path.join(dir, name));
  });
  watcher.on('error', () => win?.webContents.send('comprimo:watch-error', 'Se perdió el acceso a la carpeta vigilada.'));
  return true;
});

ipcMain.handle('comprimo:unwatch', () => {
  watcher?.close();
  watcher = null;
  return true;
});

ipcMain.handle('comprimo:reveal', (_e, file) => {
  if (typeof file === 'string' && allowed(file)) shell.showItemInFolder(file);
});
ipcMain.handle('comprimo:open-folder', (_e, dir) => {
  if (typeof dir === 'string' && allowed(dir)) shell.openPath(dir);
});

ipcMain.on('comprimo:progress', (_e, fraction) => {
  if (!win) return;
  const f = Number(fraction);
  win.setProgressBar(Number.isFinite(f) && f >= 0 && f < 1 ? f : -1);
});

ipcMain.on('comprimo:notify', (_e, title, body) => {
  if (Notification.isSupported() && win && !win.isFocused()) {
    new Notification({ title: String(title).slice(0, 80), body: String(body).slice(0, 200), silent: true }).show();
  }
});

ipcMain.handle('comprimo:info', () => ({ version: app.getVersion(), platform: process.platform }));
