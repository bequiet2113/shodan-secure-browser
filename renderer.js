const { ipcRenderer } = require('electron');

const tabBar = document.getElementById('tab-bar');
const viewsContainer = document.getElementById('views-container');
const cmdInput = document.getElementById('cmd-input');
const statusLog = document.getElementById('status-log');

let tabs = [];
let activeTabId = null;
let isRoot = false;
let historyLog = [];

function log(msg, isError = false) {
  statusLog.style.color = isError ? '#ff3333' : '#00ff41';
  statusLog.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
}

function isAllowedDomain(url) {
  if (isRoot) return true;
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'shodan.io' || parsed.hostname.endsWith('.shodan.io');
  } catch {
    return false;
  }
}

function formatTargetUrl(input) {
  if (input.startsWith('http://') || input.startsWith('https://')) return input;
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/.*)?$/;
  if (ipRegex.test(input)) return `http://${input}`;
  return `https://${input}`;
}

function createTab(url = 'https://www.shodan.io', bypassRestriction = false) {
  if (!bypassRestriction && !isAllowedDomain(url)) {
    log(`ODMOWA DOSTĘPU: ${url}. Wymagany 'sudo onc' lub 'sudo'.`, true);
    return;
  }

  const id = 'tab_' + Date.now();
  historyLog.push({ time: new Date().toLocaleTimeString(), url });

  const tabEl = document.createElement('div');
  tabEl.className = 'tab';
  
  const titleSpan = document.createElement('span');
  titleSpan.style.overflow = 'hidden';
  titleSpan.style.textOverflow = 'ellipsis';
  titleSpan.textContent = url.replace(/^https?:\/\//, '');
  titleSpan.onclick = () => switchTab(id);

  const closeBtn = document.createElement('span');
  closeBtn.className = 'tab-close';
  closeBtn.textContent = '×';
  closeBtn.title = 'Zamknij kartę';
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    closeTabById(id);
  };

  tabEl.appendChild(titleSpan);
  tabEl.appendChild(closeBtn);
  tabBar.appendChild(tabEl);

  const webview = document.createElement('webview');
  webview.src = url;
  
  webview.addEventListener('will-navigate', (e) => {
    if (!bypassRestriction && !isAllowedDomain(e.url)) {
      e.preventDefault();
      webview.stop();
      log(`ZABLOKOWANO NAWIGACJĘ: ${e.url}`, true);
    }
  });

  webview.addEventListener('new-window', (e) => {
    e.preventDefault();
    createTab(e.url, true);
  });

  webview.addEventListener('page-title-updated', (e) => {
    titleSpan.textContent = e.title;
  });

  viewsContainer.appendChild(webview);
  tabs.push({ id, tabEl, webview, titleSpan });
  switchTab(id);
}

function switchTab(id) {
  activeTabId = id;
  tabs.forEach(t => {
    const isActive = t.id === id;
    t.tabEl.classList.toggle('active', isActive);
    t.webview.classList.toggle('active', isActive);
  });
}

function closeTabById(id) {
  if (tabs.length <= 1) {
    log('Nie można zamknąć ostatniej aktywnej karty.', true);
    return;
  }
  const index = tabs.findIndex(t => t.id === id);
  if (index === -1) return;

  const [removed] = tabs.splice(index, 1);
  removed.tabEl.remove();
  removed.webview.remove();

  if (activeTabId === id) {
    const newActive = tabs[Math.max(0, index - 1)];
    switchTab(newActive.id);
  }
  log('Karta została zamknięta.');
}

// Obsługa komend terminala
cmdInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const raw = cmdInput.value.trim();
  cmdInput.value = '';
  if (!raw) return;

  const parts = raw.split(' ');
  const cmd = parts[0].toLowerCase();
  const subcmd = parts[1] ? parts[1].toLowerCase() : null;
  const args = parts.slice(2);

  switch (cmd) {
    case 'help':
      log('Komendy: sudo | sudo onc <dns/ip> | sudo exit | sudo restart | close | history | wipe | back | reload');
      break;

    case 'sudo':
      if (!subcmd) {
        isRoot = true;
        log('[SUDO] Pełne uprawnienia roota aktywowane.');
      } else if (subcmd === 'onc') {
        const target = parts[2];
        if (!target) return log('Podaj adres. Użyj: sudo onc <dns/ip>', true);
        const finalUrl = formatTargetUrl(target);
        log(`[SECURE TUNNEL] Otwieranie: ${finalUrl}`);
        createTab(finalUrl, true);
      } else if (subcmd === 'exit') {
        log('[SUDO] Awaryjne zamknięcie systemu...');
        setTimeout(() => ipcRenderer.send('app-exit'), 500);
      } else if (subcmd === 'restart') {
        log('[SUDO] Restartowanie środowiska przeglądarki...');
        setTimeout(() => ipcRenderer.send('app-restart'), 500);
      } else {
        log(`Nieznana składnia sudo: '${subcmd}'. Wpisz 'help'.`, true);
      }
      break;

    case 'close':
      if (activeTabId) closeTabById(activeTabId);
      break;

    case 'history':
      if (historyLog.length === 0) {
        log('Brak wpisów w historii.');
      } else {
        log('--- HISTORIA SESJI ---');
        historyLog.forEach((h, idx) => {
          setTimeout(() => log(`${idx + 1}. [${h.time}] ${h.url}`), idx * 50);
        });
      }
      break;

    case 'wipe':
      historyLog = [];
      const currentActive = tabs.find(t => t.id === activeTabId);
      if (currentActive) currentActive.webview.reload();
      log('[WIPE] Wyczyszczono historię i pamięć podręczną.');
      break;

    case 'back':
      const curr = tabs.find(t => t.id === activeTabId);
      if (curr && curr.webview.canGoBack()) curr.webview.goBack();
      break;

    case 'reload':
      const act = tabs.find(t => t.id === activeTabId);
      if (act) act.webview.reload();
      break;

    default:
      log(`Nieznana komenda: '${cmd}'. Wpisz 'help'.`, true);
  }
});

createTab('https://www.shodan.io');