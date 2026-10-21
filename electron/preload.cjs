// Narrow bridge between the sandboxed UI and the main process. No Node APIs are exposed.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('comprimoDesktop', {
  pickFolder: (purpose) => ipcRenderer.invoke('comprimo:pick-folder', purpose),
  save: (dir, name, bytes) => ipcRenderer.invoke('comprimo:save', dir, name, bytes),
  read: (file) => ipcRenderer.invoke('comprimo:read', file),
  list: (dir) => ipcRenderer.invoke('comprimo:list', dir),
  watch: (dir, outDir) => ipcRenderer.invoke('comprimo:watch', dir, outDir),
  unwatch: () => ipcRenderer.invoke('comprimo:unwatch'),
  reveal: (file) => ipcRenderer.invoke('comprimo:reveal', file),
  openFolder: (dir) => ipcRenderer.invoke('comprimo:open-folder', dir),
  progress: (fraction) => ipcRenderer.send('comprimo:progress', fraction),
  notify: (title, body) => ipcRenderer.send('comprimo:notify', title, body),
  info: () => ipcRenderer.invoke('comprimo:info'),
  onWatchFile: (cb) => {
    const h = (_e, file) => cb(file);
    ipcRenderer.on('comprimo:watch-file', h);
    return () => ipcRenderer.removeListener('comprimo:watch-file', h);
  },
  onMenu: (cb) => {
    const h = (_e, cmd) => cb(cmd);
    ipcRenderer.on('comprimo:menu', h);
    return () => ipcRenderer.removeListener('comprimo:menu', h);
  },
  onWatchError: (cb) => {
    const h = (_e, msg) => cb(msg);
    ipcRenderer.on('comprimo:watch-error', h);
    return () => ipcRenderer.removeListener('comprimo:watch-error', h);
  },
});
