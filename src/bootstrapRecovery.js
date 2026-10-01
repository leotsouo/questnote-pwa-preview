import { WEBSITE_SHARE_URL } from './shareService.js';

export function readServiceWorker(navigatorLike = globalThis.navigator) {
  try { return navigatorLike?.serviceWorker; } catch { return undefined; }
}

export function readSessionStorage() {
  try { return globalThis.sessionStorage; } catch { return undefined; }
}

export function unavailableBrowserError(cause) {
  return Object.assign(new Error('目前的瀏覽器無法開啟 QuestNote，請用 Safari 或 Chrome 開啟。'), {
    code: 'BROWSER_UNSUPPORTED', cause,
  });
}

export function isBlockedRegistration(error) {
  return ['SecurityError', 'NotSupportedError'].includes(error?.name)
    || /app[- ]bound|non app-bound/i.test(error?.message || '');
}

/** No App module, database or saved data is accessed by this recovery screen. */
export function renderBootstrapRecovery(error, {
  documentLike = document,
  navigatorLike = navigator,
  baseUrl = new URL('../', import.meta.url),
  retry = () => location.reload(),
} = {}) {
  const host = documentLike.getElementById('app-loader') || documentLike.body;
  const app = documentLike.getElementById('app');
  if (app) app.inert = true;
  host.classList.add('app-loader--recovery');
  const element = (tag, className, text) => {
    const node = documentLike.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const card = element('section', 'boot-recovery');
  card.setAttribute('aria-labelledby', 'boot-recovery-title');
  const icon = element('img', 'boot-recovery-icon');
  icon.src = new URL('assets/brand/questnote-icon-192.png', baseUrl).href;
  icon.alt = '';
  icon.width = 52; icon.height = 52;
  const brand = element('p', 'boot-recovery-brand', 'QuestNote · 開始同行');
  const unsupported = error?.code === 'BROWSER_UNSUPPORTED';
  const title = element('h1', 'boot-recovery-title', unsupported ? '換個瀏覽器，\n繼續你的冒險。' : '這次還沒準備好。');
  title.id = 'boot-recovery-title';
  const explanation = typeof error?.message === 'string' && /[\u3400-\u9fff]/.test(error.message)
    ? error.message : '連線暫時沒有回應。請稍後重新載入。';
  const intro = element('p', 'boot-recovery-intro', unsupported
    ? '目前的瀏覽器無法開啟 QuestNote。用 Safari 或 Chrome 開啟，就能開始。'
    : explanation);
  card.append(icon, brand, title, intro);
  if (unsupported) {
    const ios = /iPhone|iPad|iPod/i.test(navigatorLike.userAgent || '')
      || (navigatorLike.platform === 'MacIntel' && navigatorLike.maxTouchPoints > 1);
    const browser = ios ? 'Safari' : 'Chrome';
    const appUrl = new URL(baseUrl);
    appUrl.search = ''; appUrl.hash = '';
    const steps = element('ol', 'boot-recovery-steps');
    for (const text of ['複製下方的 App 連結。', `開啟 ${browser}，把連結貼到網址列。`, '開啟後即可使用；也可以從瀏覽器選單加入主畫面。']) {
      steps.append(element('li', '', text));
    }
    const copy = element('button', 'boot-recovery-action', '複製 App 連結');
    copy.type = 'button';
    const label = element('label', 'boot-recovery-label', 'QuestNote App 連結');
    label.htmlFor = 'boot-recovery-link';
    const input = element('input', 'boot-recovery-link');
    input.id = 'boot-recovery-link'; input.type = 'url'; input.readOnly = true; input.value = appUrl.href;
    const status = element('p', 'boot-recovery-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    copy.addEventListener('click', async () => {
      try {
        await navigatorLike.clipboard.writeText(appUrl.href);
        status.textContent = `已複製。開啟 ${browser}，貼到網址列即可。`;
      } catch {
        input.focus(); input.select();
        status.textContent = '請長按連結，選擇「複製」。';
      }
    });
    const installed = element('p', 'boot-recovery-installed', '已加入主畫面？回到主畫面，點 QuestNote 圖示就能繼續。');
    card.append(steps, copy, label, input, status, installed);
  } else {
    const button = element('button', 'boot-recovery-action', '重新載入');
    button.type = 'button'; button.addEventListener('click', retry);
    card.append(button);
  }
  const website = element('a', 'boot-recovery-website', '回到 QuestNote 官網 ↗');
  website.href = WEBSITE_SHARE_URL;
  card.append(website);
  host.replaceChildren(card);
  title.tabIndex = -1;
  title.focus({ preventScroll: true });
}
