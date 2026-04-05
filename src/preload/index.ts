import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('orb', {
  toggleFloat: () => ipcRenderer.invoke('toggle-float'),

  floatNavigate: (url: string) => ipcRenderer.invoke('float-navigate', url),

  onOpenUrl: (callback: (url: string) => void) => {
    ipcRenderer.on('open-url', (_event, url: string) => callback(url));
  },

  platform: process.platform,
});
