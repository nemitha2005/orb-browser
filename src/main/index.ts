import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

const isDev = process.argv.includes('--dev');

let mainWindow: BrowserWindow | null = null;
let floatWindow: BrowserWindow | null = null;

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
    },
  });

  floatWindow.loadFile(path.join(__dirname, '../../public/float.html'));

  floatWindow.on('blur', () => {
    floatWindow?.hide();
  });
}

ipcMain.handle('toggle-float', () => {
  if (!floatWindow) return;
  if (floatWindow.isVisible()) {
    floatWindow.hide();
  } else {
    floatWindow.center();
    floatWindow.show();
    floatWindow.focus();
  }
});

ipcMain.handle('float-navigate', (_event, url: string) => {
  floatWindow?.hide();
  mainWindow?.webContents.send('open-url', url);
});

app.whenReady().then(() => {
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
