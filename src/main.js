const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');
app.commandLine.appendSwitch('disable-renderer-backgrounding'); // áudio segue com janela minimizada
let win;
app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 460, height: 620, resizable: false, title: 'Clearmic', backgroundColor: '#0f1115',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false },
  });
  win.webContents.session.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'media'));
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
});
app.on('window-all-closed', () => app.quit());

// Teste de fumaça: CLEARMIC_SMOKE=1 liga o pipeline com dispositivo falso e imprime os níveis.
if (process.env.CLEARMIC_SMOKE) {
  app.commandLine.appendSwitch('use-fake-device-for-media-stream');
  app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
  app.whenReady().then(() => setTimeout(async () => {
    const r = await win.webContents.executeJavaScript(`(async()=>{await new Promise(r=>setTimeout(r,800));
      document.getElementById('toggle').click(); await new Promise(r=>setTimeout(r,3000));
      return {status:document.getElementById('status').textContent,in:document.getElementById('mIn').style.width,
        out:document.getElementById('mOut').style.width,vad:document.getElementById('vad').textContent,
        inputs:document.getElementById('input').options.length}})()`);
    console.log('SMOKE', JSON.stringify(r)); app.quit();
  }, 1500));
}
