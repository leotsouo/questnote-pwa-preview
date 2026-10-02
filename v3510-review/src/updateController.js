import { askWorker } from './updateProtocol.js';
import { beginUpdate, endUpdate } from './updateActivity.js';
import { openDB } from './db.js';

let registration = null;
let working = false;
let message = '連網檢查新版，已儲存的冒險資料會保留。';
let showIconGuide = () => {};
let openBackupSettings = () => {};

export function updateControlsHtml() {
  return `<div class="app-update-controls">
    <p class="app-update-status" data-app-update-status role="status" aria-live="polite"></p>
    <div class="app-update-actions">
      <button type="button" class="btn btn--primary" data-app-update="apply">檢查並更新</button>
      <button type="button" class="btn btn--ghost" data-app-update="reload">重新載入 App</button>
    </div>
    <button type="button" class="app-icon-entry" data-app-update="icon">
      <img src="assets/brand/questnote-icon-180.png" width="44" height="44" alt="">
      <span><strong>更新主畫面圖示</strong><small>同行星芽 · 查看手機設定步驟</small></span>
      <span aria-hidden="true">›</span>
    </button>
  </div>`;
}

export function iconGuideHtml() {
  // This remains the same origin and start URL: no reset, uninstall or new app ID.
  const url = new URL('index.html', registration?.scope || new URL('../', import.meta.url));
  return `<div class="app-icon-guide">
    <img src="assets/brand/questnote-icon-180.png" width="88" height="88" alt="QuestNote 新圖示：同行星芽">
    <h2 class="modal-title">換上同行星芽</h2>
    <p>App 已使用這個新圖示。iPhone 的舊主畫面圖示可能仍保留安裝時的圖片，需要重新加入。</p>
    <ol>
      <li>先在「設定與資料」匯出 JSON 備份。</li>
      <li>在 Safari 開啟下方同一個 QuestNote 網址，確認圖示已更新。</li>
      <li>點 Safari「分享」→「加入主畫面」。若有「作為網頁 App 開啟」，請保持開啟。</li>
      <li>先開啟新入口，確認任務與寵物都在。若新入口沒有資料，先匯入剛才的 JSON 備份，確認恢復成功後再整理舊入口。</li>
    </ol>
    <p>若手機出現「刪除 App」或清除資料的提示，請先取消，保留舊入口與備份。不要清除網站資料。</p>
    <p>Android 通常會自動更新圖示；若仍是舊圖示，也可先備份再重新加入。請勿為了換圖示解除安裝或清除儲存空間。</p>
    <button type="button" class="btn btn--ghost app-icon-url" data-app-update="backup">到設定匯出備份</button>
    <a class="btn btn--primary app-icon-url" href="${url.href}" target="_blank" rel="noopener">開啟 QuestNote 網址</a>
    <p class="app-icon-address">${url.href}</p>
  </div>`;
}

export function refreshUpdateControls() {
  document.querySelectorAll('[data-app-update-status]').forEach((element) => { element.textContent = message; });
  document.querySelectorAll('[data-app-update]').forEach((button) => {
    button.disabled = working || (!registration && ['apply', 'reload'].includes(button.dataset.appUpdate));
    if (button.dataset.appUpdate === 'apply') {
      button.textContent = working ? '正在準備更新…' : registration?.waiting ? '更新並重新載入' : '檢查並更新';
    }
  });
}

function setMessage(value) { message = value; refreshUpdateControls(); }

function showUpdateBanner() {
  if (document.getElementById('update-banner')) { refreshUpdateControls(); return; }
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.className = 'update-banner show';
  banner.innerHTML = `<div><strong>新的冒險篇章已準備好</strong><p data-app-update-status role="status" aria-live="polite"></p></div>
    <div class="app-update-actions"><button type="button" class="btn btn--primary" data-app-update="apply">更新並重新載入</button>
    <button type="button" class="btn btn--ghost" data-app-update="later">稍後</button></div>`;
  document.body.appendChild(banner);
  refreshUpdateControls();
}

async function waitForInstall(worker) {
  if (!worker || worker.state === 'installed' || worker.state === 'activated') return;
  await new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer); worker.removeEventListener('statechange', changed);
      error ? reject(error) : resolve();
    };
    const changed = () => {
      if (worker.state === 'installed' || worker.state === 'activated') finish();
      else if (worker.state === 'redundant') finish(new Error('新版檔案未通過完整驗證，保留目前版本；請稍後重試。'));
    };
    const timer = setTimeout(() => finish(new Error('新版仍在下載，請稍後再按更新。')), 60000);
    worker.addEventListener('statechange', changed); changed();
  });
}

function hasOpenWork() {
  return document.body.classList.contains('modal-open')
    || [...document.querySelectorAll('[role="dialog"][aria-modal="true"], #view-feedback, #view-import')]
      .some((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
}

async function drainSavedWrites() {
  const db = await openDB();
  // An all-store transaction queues after pending writes without changing records.
  await new Promise((resolve, reject) => {
    const tx = db.transaction([...db.objectStoreNames], 'readwrite');
    tx.oncomplete = resolve;
    tx.onabort = tx.onerror = () => reject(tx.error || new Error('存檔尚未完成，請稍後重試。'));
  });
}

async function reloadSafely({ update = false } = {}) {
  if (hasOpenWork() || !beginUpdate()) throw new Error('請先完成或關閉目前的編輯、召喚或資料操作，再按更新。');
  const app = document.getElementById('app');
  const wasInert = app?.inert || false;
  if (app) app.inert = true;
  let timer;
  let controllerChanged;
  let reloading = false;
  try {
    await drainSavedWrites();
    if (!update || !registration.waiting) { reloading = true; location.reload(); return; }
    const worker = registration.waiting;
    const ready = await askWorker(worker, 'QUESTNOTE_UPDATE_INFO');
    if (!ready?.artifactId || ready.scopePath !== new URL(registration.scope).pathname) throw new Error('無法確認新版，保留目前版本；請稍後重試。');
    const activated = new Promise((resolve, reject) => {
      controllerChanged = () => resolve();
      navigator.serviceWorker.addEventListener('controllerchange', controllerChanged, { once: true });
      timer = setTimeout(() => reject(new Error('新版尚未啟用，請稍後重試。')), 15000);
    });
    activated.catch(() => {});
    // Install is verified. The worker still vetoes a switch while other app windows exist.
    const result = await askWorker(worker, 'QUESTNOTE_APPLY_UPDATE', { artifactId: ready.artifactId });
    if (result?.status !== 'accepted') {
      // Consume the listener promise on a veto; it must not become a later unhandled rejection.
      activated.catch(() => {});
      throw new Error(result?.status === 'other-clients'
        ? '另一個 QuestNote 視窗仍開著，請先關閉其他分頁，再按更新；這個 App 不用關閉。'
        : '新版尚未準備完成，保留目前版本；請稍後重試。');
    }
    await activated;
    reloading = true;
    location.reload();
  } finally {
    clearTimeout(timer);
    if (controllerChanged) navigator.serviceWorker.removeEventListener('controllerchange', controllerChanged);
    if (!reloading) {
      if (app) app.inert = wasInert;
      endUpdate();
    }
  }
}

async function runUpdate(action) {
  if (working) return;
  working = true; setMessage(action === 'reload' ? '正在重新載入…' : '正在檢查並驗證新版…');
  try {
    if (action === 'reload') { await reloadSafely(); return; }
    if (!registration.waiting) {
      if (navigator.onLine === false) throw new Error('目前離線，請連網後再檢查新版。');
      await registration.update();
      await waitForInstall(registration.installing);
    }
    if (registration.waiting) { setMessage('存檔會保留，正在啟用新版…'); await reloadSafely({ update: true }); }
    else setMessage('目前已是最新版本。');
  } catch (error) { setMessage(error.message || '無法取得新版，請確認網路後重試。'); }
  finally { working = false; refreshUpdateControls(); }
}

export function initAppUpdates(reg, options = {}) {
  registration = reg;
  showIconGuide = options.showIconGuide || showIconGuide;
  openBackupSettings = options.openBackupSettings || openBackupSettings;
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-app-update]');
    if (!button || button.disabled) return;
    const action = button.dataset.appUpdate;
    if (action === 'icon') showIconGuide(iconGuideHtml());
    else if (action === 'backup') openBackupSettings();
    else if (action === 'later') document.getElementById('update-banner')?.remove();
    else if (registration) void runUpdate(action);
  });
  if (!reg) { setMessage('這個瀏覽器無法使用 App 更新功能。'); return; }
  const watch = () => {
    const worker = reg.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        setMessage('新版已驗證完成。按一下即可更新，冒險資料會保留。'); showUpdateBanner();
      }
    });
  };
  reg.addEventListener('updatefound', watch); watch();
  // A user may leave the app open throughout a release. Check quietly while visible.
  setInterval(() => {
    if (!document.hidden && !working && !reg.installing && !reg.waiting) reg.update().catch(() => {});
  }, 5 * 60 * 1000);
  if (reg.waiting) { setMessage('新版已準備好，按一下即可更新。'); showUpdateBanner(); }
  else refreshUpdateControls();
}
