import { contextBridge, ipcRenderer } from 'electron';

import { IPC_CHANNELS, parseFloatNavigatePayload } from '../shared/ipc';

contextBridge.exposeInMainWorld('orb', {
  toggleFloat: () => ipcRenderer.invoke(IPC_CHANNELS.TOGGLE_FLOAT),

  floatNavigate: (input: string) => {
    const safeUrl = parseFloatNavigatePayload(input);
    if (!safeUrl) {
      return Promise.resolve();
    }

    return ipcRenderer.invoke(IPC_CHANNELS.FLOAT_NAVIGATE, safeUrl).then(() => undefined);
  },

  onOpenUrl: (callback: (url: string) => void) => {
    ipcRenderer.on(IPC_CHANNELS.OPEN_URL, (_event, payload: unknown) => {
      const safeUrl = parseFloatNavigatePayload(payload);
      if (!safeUrl) {
        return;
      }

      callback(safeUrl);
    });
  },

  platform: process.platform,
});
