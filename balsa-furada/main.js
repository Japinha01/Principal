/* ============================================================
   BALSA FURADA — app de computador (Electron)
   Abre o jogo da pasta jogo/ numa janela própria. Os arquivos são
   servidos por app://jogo/… para os módulos JS funcionarem igual
   a um site (file:// bloqueia import de módulos).
   ============================================================ */
const { app, BrowserWindow, protocol, net, Menu, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const RAIZ = path.join(__dirname, 'jogo');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

function criaJanela() {
  const win = new BrowserWindow({
    width: 1280,
    height: 760,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: '#27304a',
    title: 'Balsa Furada',
    icon: path.join(RAIZ, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      // o anfitrião continua rodando a balsa mesmo com a janela minimizada
      backgroundThrottling: false,
    },
  });
  win.loadURL('app://jogo/index.html');

  // F11 = tela cheia
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
  });
  // links externos abrem no navegador
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

Menu.setApplicationMenu(null);

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '');
    const arq = path.normalize(path.join(RAIZ, rel));
    if (!arq.startsWith(RAIZ)) return new Response('', { status: 403 });
    return net.fetch(pathToFileURL(arq).toString());
  });
  criaJanela();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) criaJanela(); });
});

app.on('window-all-closed', () => app.quit());
