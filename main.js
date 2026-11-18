const { app, BrowserWindow, session, ipcMain } = require('electron');

function createWindow() {
  const ses = session.fromPartition('persist:anonymous-session', { cache: true });

  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0';
    delete details.requestHeaders['X-Forwarded-For'];
    callback({ requestHeaders: details.requestHeaders });
  });

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true,
      session: ses
    }
  });

  win.loadFile('index.html');
  return win;
}

app.whenReady().then(() => {
  let mainWindow = createWindow();

  // Nasłuch komendy restartu z terminala
  ipcMain.on('app-restart', () => {
    mainWindow.close();
    mainWindow = createWindow();
  });

  // Nasłuch komendy wyjścia z terminala
  ipcMain.on('app-exit', () => {
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});