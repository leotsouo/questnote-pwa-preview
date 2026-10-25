/**
 * Moving a save from the web app to the iOS app, in two screens:
 * - Web (any profile but ios): a settings card that exports the usual backup and hands
 *   it to the share sheet (save to Files / AirDrop), falling back to a download.
 * - App (ios profile, very first open): a welcome choice inside the guided practice
 *   root. "從網頁版搬過來" picks that file, previews it and restores it with the same
 *   validate → normalize → restoreBackup path as settings import.
 * Neither side changes the backup format, and the web side never writes its save.
 */
import {
  exportBackup,
  downloadBackupFile,
  readBackupFile,
  validateBackup,
  normalizeBackupPayload,
  restoreBackup,
} from '../backupService.js';
import { RELEASE_PROFILE } from '../releaseProfile.js';
import { escapeHtml } from '../uiHelpers.js';
import {
  MIGRATION_SUMMARY_ROWS,
  summarizeBackupForMigration,
  compareMigrationSummaries,
  migrationFileName,
  canShareBackupFile,
} from '../webToAppMigration.js';

function summaryHtml(summary) {
  return `<dl class="web-migration__summary">${MIGRATION_SUMMARY_ROWS.map(([key, label]) => `
    <div><dt>${label}</dt><dd>${escapeHtml(String(summary?.[key] ?? 0))}</dd></div>`).join('')}</dl>`;
}

function formatDateTime(isoString) {
  const date = new Date(isoString || '');
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/* ─── Web: settings card ─── */

let preparedFile = null;

function webCardHtml() {
  return `
    <section class="web-migration-card" id="web-migration-card" aria-labelledby="web-migration-card-title">
      <h3 class="web-migration-card__title" id="web-migration-card-title">搬到 iPhone App</h3>
      <p class="settings-backup__hint">把這裡的存檔複製一份到 iPhone 上的 QuestNote App。網頁版的資料不會被刪除，也不會被改動。</p>
      <ol class="web-migration__steps">
        <li>按「1. 準備搬家檔」，下面會出現你的資料數字。</li>
        <li>按「2. 儲存搬家檔」，在跳出的選單選「儲存到檔案」。</li>
        <li>打開 QuestNote App，選「從網頁版搬過來」，再選剛才存的檔案。</li>
        <li>App 搬完會顯示同樣的數字。跟這裡對照，一樣就是搬好了。</li>
      </ol>
      <button type="button" class="btn btn--secondary btn--block" data-web-migration="prepare">1. 準備搬家檔</button>
      <div class="web-migration-card__ready" data-web-migration-ready hidden></div>
      <p class="settings-backup__hint" data-web-migration-status role="status" aria-live="polite"></p>
    </section>`;
}

function setWebStatus(card, message) {
  const status = card.querySelector('[data-web-migration-status]');
  if (status) status.textContent = message;
}

async function prepareWebMigration(card) {
  const button = card.querySelector('[data-web-migration="prepare"]');
  button.disabled = true;
  setWebStatus(card, '正在整理資料…');
  try {
    const backup = await exportBackup();
    const summary = summarizeBackupForMigration(normalizeBackupPayload(backup));
    const name = migrationFileName();
    preparedFile = { backup, name, file: new File([JSON.stringify(backup, null, 2)], name, { type: 'application/json' }) };
    const ready = card.querySelector('[data-web-migration-ready]');
    ready.innerHTML = `
      <p class="settings-backup__hint">搬家檔已準備好（${escapeHtml(formatDateTime(backup.exportedAt))}）。請記下這些數字：</p>
      ${summaryHtml(summary)}
      <button type="button" class="btn btn--primary btn--block" data-web-migration="save">2. 儲存搬家檔</button>
      <p class="settings-backup__hint">之後如果又完成了新任務，請再按一次「1. 準備搬家檔」。</p>`;
    ready.hidden = false;
    button.textContent = '1. 重新準備搬家檔';
    setWebStatus(card, '');
    ready.querySelector('[data-web-migration="save"]')?.focus({ preventScroll: true });
  } catch (error) {
    preparedFile = null;
    setWebStatus(card, `沒有準備成功：${error?.message || '請稍後再試'}`);
  } finally {
    button.disabled = false;
  }
}

async function saveWebMigration(card) {
  if (!preparedFile) return;
  const { backup, name, file } = preparedFile;
  // Share right inside the tap: iOS only opens the sheet during a user gesture.
  if (canShareBackupFile(navigator, file)) {
    try {
      await navigator.share({ files: [file], title: 'QuestNote 搬家檔' });
      setWebStatus(card, '已交給分享選單。存好後，到 App 選這個檔案。');
      return;
    } catch (error) {
      if (error?.name === 'AbortError') {
        setWebStatus(card, '已取消，沒有儲存。需要時再按一次「2. 儲存搬家檔」。');
        return;
      }
      console.warn('[QuestNote] 分享搬家檔失敗，改用下載:', error);
    }
  }
  try {
    downloadBackupFile(backup, name);
    setWebStatus(card, `已下載 ${name}。請把它傳到 iPhone，再到 App 選這個檔案。`);
  } catch (error) {
    setWebStatus(card, `沒有儲存成功：${error?.message || '請稍後再試'}`);
  }
}

/** Add the move-to-app card under the settings export button. The iOS app has no use for it. */
export function initWebMigrationCard() {
  if (RELEASE_PROFILE?.profile === 'ios' || document.getElementById('web-migration-card')) return;
  const actions = document.querySelector('.settings-backup .settings-backup__actions');
  if (!actions) return;
  actions.insertAdjacentHTML('afterend', webCardHtml());
  const card = document.getElementById('web-migration-card');
  card.addEventListener('click', (event) => {
    const action = event.target.closest('[data-web-migration]')?.dataset.webMigration;
    if (action === 'prepare') void prepareWebMigration(card);
    if (action === 'save') void saveWebMigration(card);
  });
}

/* ─── App: first-open choice ─── */

// Kept outside the DOM so a guided re-render (foreground, skip dialog) resumes the same screen.
const appMigration = { screen: 'choice', pending: null, error: '', busy: false };
let appHost = null;
let appHandlers = {};

function appScreenHtml() {
  const { screen, pending, error } = appMigration;
  if (screen === 'choice') {
    return `
      <h2 id="web-migration-title" tabindex="-1">歡迎使用 QuestNote App</h2>
      <p>之前在 iPhone 主畫面的網頁版 QuestNote 用過嗎？可以把任務、寵物和星塵整份搬過來。</p>
      <div class="web-migration__actions">
        <button type="button" class="btn btn--primary btn--block" data-web-migration="start">從網頁版搬過來</button>
        <button type="button" class="btn btn--secondary btn--block" data-web-migration="fresh">從頭開始</button>
      </div>
      <p class="guided-note">之後也能到「設定 → 備份與恢復」匯入備份。</p>`;
  }
  if (screen === 'pick') {
    return `
      <h2 id="web-migration-title" tabindex="-1">從網頁版搬過來</h2>
      <ol class="web-migration__steps">
        <li>打開 iPhone 主畫面上的網頁版 QuestNote。</li>
        <li>到「設定」找「搬到 iPhone App」，依序按「1. 準備搬家檔」和「2. 儲存搬家檔」，選「儲存到檔案」。</li>
        <li>回到這裡，按下面的「選擇搬家檔」，選 questnote-backup 開頭的檔案。</li>
      </ol>
      ${error ? `<p class="web-migration__error" role="alert">${escapeHtml(error)}</p>` : ''}
      <input type="file" accept=".json,application/json" hidden data-web-migration-file />
      <div class="web-migration__actions">
        <button type="button" class="btn btn--primary btn--block" data-web-migration="pick">選擇搬家檔</button>
        <button type="button" class="guided-link" data-web-migration="back">返回</button>
      </div>`;
  }
  if (screen === 'preview') {
    return `
      <h2 id="web-migration-title" tabindex="-1">確認要搬的資料</h2>
      <p class="guided-note">${escapeHtml(pending.fileName)}${pending.exportedAt ? ` · 匯出於 ${escapeHtml(formatDateTime(pending.exportedAt))}` : ''}</p>
      ${pending.warnings.length ? `<p class="web-migration__error">${escapeHtml(pending.warnings.join(' '))}</p>` : ''}
      ${summaryHtml(pending.summary)}
      <p>跟網頁版顯示的數字一樣嗎？一樣就按「搬過來」。</p>
      ${error ? `<p class="web-migration__error" role="alert">${escapeHtml(error)}</p>` : ''}
      <div class="web-migration__actions">
        <button type="button" class="btn btn--primary btn--block" data-web-migration="restore">${error ? '再試一次' : '搬過來'}</button>
        <button type="button" class="btn btn--secondary btn--block" data-web-migration="pick-again">換一個檔案</button>
      </div>`;
  }
  return `
    <h2 id="web-migration-title" tabindex="-1">正在搬資料</h2>
    <p role="status">請稍等，不要關掉 App。</p>`;
}

function renderAppMigration() {
  if (!appHost?.isConnected) return;
  appHost.innerHTML = `<div class="web-migration-shade" aria-hidden="true"></div>
    <section class="web-migration" role="dialog" aria-modal="true" aria-labelledby="web-migration-title">${appScreenHtml()}</section>`;
  requestAnimationFrame(() => appHost?.querySelector('#web-migration-title')?.focus({ preventScroll: true }));
}

function showAppScreen(screen, error = '') {
  Object.assign(appMigration, { screen, error });
  renderAppMigration();
}

async function readMigrationFile(file) {
  try {
    const raw = await readBackupFile(file);
    const validation = validateBackup(raw);
    if (!validation.valid) throw new Error(validation.error || '這不是 QuestNote 的搬家檔。');
    const normalized = normalizeBackupPayload(raw);
    appMigration.pending = {
      normalized,
      fileName: file.name,
      exportedAt: normalized.exportedAt,
      warnings: validation.warnings || [],
      summary: summarizeBackupForMigration(normalized),
    };
    showAppScreen('preview');
  } catch (error) {
    appMigration.pending = null;
    showAppScreen('pick', `這個檔案不能用：${error?.message || '讀取失敗'}。請選 questnote-backup 開頭的 .json 檔。`);
  }
}

async function restoreFromWeb() {
  const { pending } = appMigration;
  if (!pending || appMigration.busy) return;
  appMigration.busy = true;
  showAppScreen('restoring');
  try {
    // One transaction: on failure the app stays exactly as empty as before.
    await restoreBackup(pending.normalized);
  } catch (error) {
    console.error('[QuestNote] 從網頁版搬家失敗:', error);
    appMigration.busy = false;
    showAppScreen('preview', '搬家沒有完成，App 裡沒有留下任何資料。網頁版的資料也還在，可以再試一次。');
    return;
  }
  let arrived = null;
  try {
    arrived = summarizeBackupForMigration(normalizeBackupPayload(await exportBackup()));
  } catch (error) {
    console.warn('[QuestNote] 搬家後無法讀回摘要:', error);
  }
  try {
    await appHandlers.onRestored?.();
  } catch (error) {
    console.warn('[QuestNote] 搬家後關閉教學失敗:', error);
  }
  appMigration.busy = false;
  appMigration.pending = null;
  showMigrationDone(arrived, pending.summary);
}

function showMigrationDone(arrived, expected) {
  const mismatches = arrived ? compareMigrationSummaries(expected, arrived) : null;
  const note = mismatches === null
    ? '<p class="web-migration__error">資料已搬進 App，但無法讀回數字。請重新開啟 App，到「設定」核對。</p>'
    : mismatches.length
      ? `<p class="web-migration__error">這些數字和搬家檔不同：${escapeHtml(mismatches.join('、'))}。請保留搬家檔，並從「設定 → 回報問題」告訴我們。</p>`
      : '<p>數字和搬家檔一樣，跟網頁版對照看看。</p>';
  const overlay = document.createElement('div');
  overlay.className = 'web-migration-done';
  overlay.innerHTML = `<div class="web-migration-shade" aria-hidden="true"></div>
    <section class="web-migration" role="dialog" aria-modal="true" aria-labelledby="web-migration-done-title">
      <h2 id="web-migration-done-title" tabindex="-1">搬家完成</h2>
      ${summaryHtml(arrived || expected)}
      ${note}
      <p class="guided-note">網頁版的資料沒有被刪除，可以留著備用。</p>
      <div class="web-migration__actions">
        <button type="button" class="btn btn--primary btn--block" data-web-migration="begin">開始使用</button>
      </div>
    </section>`;
  // Reloading applies the restored theme, font size and reading mode from the start.
  overlay.querySelector('[data-web-migration="begin"]').addEventListener('click', () => window.location.reload());
  document.body.append(overlay);
  requestAnimationFrame(() => overlay.querySelector('#web-migration-done-title')?.focus({ preventScroll: true }));
}

/**
 * Draw the first-open choice into the guided practice root.
 * handlers.onStartFresh: continue with the normal welcome step.
 * handlers.onRestored: dismiss the practice after a successful restore.
 */
export function renderWebMigrationChoice(host, handlers) {
  appHandlers = handlers;
  if (appHost !== host) {
    appHost = host;
    host.addEventListener('click', (event) => {
      const action = event.target.closest('[data-web-migration]')?.dataset.webMigration;
      if (!action || appMigration.busy) return;
      if (action === 'start' || action === 'back') showAppScreen(action === 'start' ? 'pick' : 'choice');
      if (action === 'fresh') appHandlers.onStartFresh?.();
      if (action === 'pick' || action === 'pick-again') {
        if (action === 'pick-again') showAppScreen('pick');
        appHost.querySelector('[data-web-migration-file]')?.click();
      }
      if (action === 'restore') void restoreFromWeb();
    });
    host.addEventListener('change', (event) => {
      if (!event.target.matches('[data-web-migration-file]')) return;
      const file = event.target.files?.[0];
      if (file) void readMigrationFile(file);
    });
  }
  renderAppMigration();
}
