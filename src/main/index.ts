import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'path';

import { IPC_CHANNELS, parseFloatNavigatePayload } from '../shared/ipc';
import { isHttpNavigationUrl } from '../shared/url';

const isDev = process.argv.includes('--dev');

let mainWindow: BrowserWindow | null = null;
let floatWindow: BrowserWindow | null = null;

function isTrustedAppUrl(rawUrl: string): boolean {
  try {
    const parsedUrl = new URL(rawUrl);
    return parsedUrl.protocol === 'file:' || parsedUrl.protocol === 'devtools:';
  } catch {
    return false;
  }
}

function isAppWindowContents(contentsId: number): boolean {
  return (
    contentsId === mainWindow?.webContents.id ||
    contentsId === floatWindow?.webContents.id
  );
}

function configureSessionSecurity(): void {
  const defaultSession = session.defaultSession;

  defaultSession.setPermissionCheckHandler(() => false);
  defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
}

function configureWebContentsSecurity(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));

    contents.on('will-navigate', (event, navigationUrl) => {
      if (isAppWindowContents(contents.id)) {
        if (!isTrustedAppUrl(navigationUrl)) {
          event.preventDefault();
        }
        return;
      }

      if (!isHttpNavigationUrl(navigationUrl)) {
        event.preventDefault();
      }
    });
  });
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f0f0f',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../../public/index.html'));

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createFloatWindow(): void {
  floatWindow = new BrowserWindow({
    width: 660,
    height: 64,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  floatWindow.loadFile(path.join(__dirname, '../../public/float.html'));

  floatWindow.on('blur', () => {
    floatWindow?.hide();
  });
}

ipcMain.handle(IPC_CHANNELS.TOGGLE_FLOAT, () => {
  if (!floatWindow) return;
  if (floatWindow.isVisible()) {
    floatWindow.hide();
  } else {
    floatWindow.center();
    floatWindow.show();
    floatWindow.focus();
  }
});

ipcMain.handle(IPC_CHANNELS.FLOAT_NAVIGATE, (_event, payload: unknown) => {
  const safeUrl = parseFloatNavigatePayload(payload);
  if (!safeUrl) {
    return;
  }

  floatWindow?.hide();
  mainWindow?.webContents.send(IPC_CHANNELS.OPEN_URL, safeUrl);
});

process.on('uncaughtException', (error) => {
  console.error('[main] uncaughtException', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection', reason);
});

app.whenReady().then(() => {
  configureSessionSecurity();
  configureWebContentsSecurity();

  createMainWindow();
  createFloatWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
