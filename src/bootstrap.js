import { RELEASE_PROFILE } from './releaseProfile.js';

/** Never open a release database from an uncontrolled, potentially mixed deployment. */
export async function bootApplication({
  profile = RELEASE_PROFILE,
  marker = document.querySelector('meta[name="questnote-artifact"]')?.content || null,
  serviceWorker = navigator.serviceWorker,
  baseUrl = new URL('../', import.meta.url),
  reload = () => location.reload(),
  attemptStorage = sessionStorage,
  start = () => import('./app.js'),
  timeoutMs = 60000,
} = {}) {
  if (profile === null && marker === null) { await start(); return 'source'; }
  if (!profile || !/^[a-f0-9]{64}$/.test(profile.artifactId || '') || marker !== profile.artifactId
    || new URL(baseUrl).pathname !== profile.scopePath) {
    throw new Error('發布檔案版本不一致，請稍後重新開啟。');
  }
  if (!serviceWorker) throw new Error('此發布版本需要安全連線與 Service Worker，請使用 HTTPS 開啟。');
  const expectedWorkerUrl = new URL(`service-worker.js?artifact=${profile.artifactId}`, baseUrl).href;
  const attemptKey = `questnote-boot:${profile.artifactId}`;
  if (serviceWorker.controller?.scriptURL === expectedWorkerUrl) {
    attemptStorage.removeItem(attemptKey); await start(); return 'controlled';
  }
  const incompatibleController = !!serviceWorker.controller;
  if (attemptStorage.getItem(attemptKey)) throw new Error('無法取得已驗證的離線版本，請關閉其他 QuestNote 視窗後重試。');

  const registration = await serviceWorker.register(
    expectedWorkerUrl,
    { scope: profile.scopePath, updateViaCache: 'none' },
  );
  // An existing active generation can serve a coherent page even if a newer one is waiting.
  const worker = incompatibleController
    ? registration.installing || registration.waiting || registration.active
    : registration.active || registration.installing || registration.waiting;
  if (!worker) throw new Error('無法準備離線檔案，請稍後重試。');
  const ready = () => worker.state === 'activated' || (incompatibleController && worker.state === 'installed');
  if (!ready()) {
    await new Promise((resolve, reject) => {
      const finish = (error) => {
        clearTimeout(timer);
        worker.removeEventListener('statechange', check);
        error ? reject(error) : resolve();
      };
      const check = () => {
        if (ready()) finish();
        else if (worker.state === 'redundant') finish(new Error('必要檔案驗證失敗，請稍後重試。'));
      };
      const timer = setTimeout(() => finish(new Error('發布檔案尚未準備完成，請關閉其他 QuestNote 視窗後重試。')), timeoutMs);
      worker.addEventListener('statechange', check);
      check();
    });
  }
  // A legacy network-first worker may serve this new index with old JS. Never
  // start that mixture or force the waiting worker to interrupt its other clients.
  if (incompatibleController) throw new Error('新版已準備，請關閉所有 QuestNote 分頁與視窗，再重新開啟以完成安全更新。');
  attemptStorage.setItem(attemptKey, '1');
  reload();
  return 'reload';
}

if (typeof document !== 'undefined') {
  bootApplication().catch((error) => {
    const host = document.getElementById('app-loader') || document.body;
    const message = document.createElement('p');
    message.textContent = error.message || '啟動失敗，請稍後重試。';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = '重新載入';
    retry.addEventListener('click', () => {
      try { sessionStorage.removeItem(`questnote-boot:${RELEASE_PROFILE?.artifactId}`); } catch { /* Keep failure visible when storage is unavailable. */ }
      location.reload();
    });
    host.replaceChildren(message, retry);
  });
}
