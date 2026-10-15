/** Legacy source-preview diagnostics. Disabled in every assembled release. */
import { RELEASE_PROFILE } from './releaseProfile.js';
import { grantDevStardust } from './devService.js';
import { playSummonReveal } from './summonRevealService.js';

const OVERLAY_SELECTOR = '.dream-bloom-overlay, .summon-reveal-overlay, .dream-debut-overlay, .pool-awakening-overlay';

export function startPerfDiagnostics(state, refreshState) {
  if (RELEASE_PROFILE || location.hostname !== 'leotsouo.github.io'
    || !location.pathname.startsWith('/questnote-pwa-preview/')
    || new URLSearchParams(location.search).get('perf') !== '1') return;

  const panel = document.createElement('details');
  panel.id = 'questnote-perf';
  panel.style.cssText = 'position:fixed;z-index:99999;top:env(safe-area-inset-top, 0px);right:8px;max-width:min(92vw,360px);padding:6px 10px;background:#101827ee;color:#fff;border:1px solid #a78bfa;border-radius:8px;font:12px/1.4 system-ui;';
  panel.innerHTML = '<summary>效能診斷</summary><div style="display:flex;gap:4px;flex-wrap:wrap;margin:6px 0"><button type="button" data-perf="fund">測試星塵</button><button type="button" data-perf="ssr">展示 SSR</button><button type="button" data-perf="ur">展示 UR</button></div><pre style="white-space:pre-wrap;max-height:40vh;overflow:auto;margin:0" data-perf-output>點擊召喚或展示按鈕開始記錄。</pre>';
  document.body.appendChild(panel);
  const output = panel.querySelector('[data-perf-output]');
  let run = null;
  let frameId = 0;
  let overlayObserver = null;

  const finish = () => {
    if (!run) return;
    cancelAnimationFrame(frameId);
    overlayObserver?.disconnect();
    const end = performance.now();
    const ready = run.ready ?? end;
    const activePhases = run.phases.filter((phase) => phase.at < ready);
    const phases = activePhases.map((phase, i) => {
      const next = activePhases[i + 1]?.at ?? ready;
      return `${phase.name}: ${Math.round(next - phase.at)} ms`;
    });
    const report = `${run.label}\n點擊→演出: ${run.appear === null ? '未出現' : `${Math.round(run.appear - run.start)} ms`}\n演出至可關閉: ${run.appear === null ? '—' : `${Math.round(Math.max(0, ready - run.appear))} ms`}\n>50 ms 影格: ${run.longFrames.length}（最長 ${Math.round(Math.max(0, ...run.longFrames))} ms）\n${phases.join('\n')}\n等待操作: ${Math.round(end - ready)} ms`;
    output.textContent = report;
    window.questnotePerfLastResult = { ...run, end, report };
    run = null;
  };

  const watchFrames = (now) => {
    if (!run || run.ready !== null) return;
    if (run.previousFrame !== null) {
      const gap = now - run.previousFrame;
      if (gap > 50) run.longFrames.push(gap);
    }
    run.previousFrame = now;
    frameId = requestAnimationFrame(watchFrames);
  };

  const markReady = () => {
    if (!run || run.ready !== null) return;
    run.ready = performance.now();
    cancelAnimationFrame(frameId);
  };

  const markOverlay = (overlay) => {
    if (!run || run.overlay === overlay) return;
    if (run.overlay?.isConnected) {
      run.phases.push({ name: overlay.className, at: performance.now() });
      return;
    }
    run.overlay = overlay;
    run.phases.push({ name: overlay.className, at: performance.now() });
    requestAnimationFrame((now) => {
      if (!run || run.overlay !== overlay) return;
      if (run.appear === null) run.appear = now;
      run.previousFrame = now;
      frameId = requestAnimationFrame(watchFrames);
    });
    overlayObserver?.disconnect();
    overlayObserver = new MutationObserver(() => {
      if (!run) return;
      if (!overlay.isConnected || (overlay.id === 'modal-overlay' && !overlay.classList.contains('open'))) { finish(); return; }
      const phase = overlay.dataset.state || overlay.dataset.phase || overlay.className;
      if (phase !== run.phases.at(-1)?.name) run.phases.push({ name: phase, at: performance.now() });
      if (overlay.classList.contains('is-ready') || overlay.dataset.state === 'summary') markReady();
    });
    overlayObserver.observe(overlay, { attributes: true, attributeFilter: ['class', 'data-state', 'data-phase'] });
    if (overlay.id === 'modal-overlay') setTimeout(() => {
      if (run?.overlay === overlay) markReady();
    }, 800);
  };

  const bodyObserver = new MutationObserver((records) => {
    if (!run) return;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        const overlay = node.matches?.(OVERLAY_SELECTOR) ? node : node.querySelector?.(OVERLAY_SELECTOR);
        if (overlay) markOverlay(overlay);
      }
      for (const node of record.removedNodes) {
        if (run?.overlay === node) finish();
      }
    }
  });
  bodyObserver.observe(document.body, { childList: true });

  const modal = document.getElementById('modal-overlay');
  if (modal) new MutationObserver(() => {
    if (!run || run.overlay) return;
    if (modal.classList.contains('open') && modal.querySelector('.summon-result-single, .sweet-summon-result--ten, .default-summon-result--ten')) markOverlay(modal);
  }).observe(modal, { attributes: true, attributeFilter: ['class'] });

  const begin = (label) => {
    finish();
    run = { label, start: performance.now(), appear: null, ready: null, previousFrame: null, longFrames: [], phases: [], overlay: null };
    output.textContent = `${label}：記錄中…`;
    const existing = document.querySelector(OVERLAY_SELECTOR);
    if (existing) markOverlay(existing);
    setTimeout(() => { if (run?.label === label) finish(); }, 30000);
  };

  document.addEventListener('click', (event) => {
    const target = event.target.closest?.('#btn-pull, #btn-pull-ten, .nav-item[data-view="gacha"], [data-perf="ssr"], [data-perf="ur"]');
    if (target) {
      begin(target.id || target.dataset.perf || '卡池入場');
      if (target.matches('.nav-item[data-view="gacha"]')) requestAnimationFrame((now) => {
        if (!run) return;
        run.appear = now;
        run.phases.push({ name: '卡池已顯示', at: now });
        finish();
      });
    }
  }, true);

  panel.addEventListener('click', async (event) => {
    const action = event.target.dataset.perf;
    if (action === 'fund') {
      const amount = await grantDevStardust();
      await refreshState({ renderMode: ['gacha'] });
      output.textContent = `預覽站本機測試星塵：${amount.toLocaleString()}`;
    } else if (action === 'ssr' || action === 'ur') {
      const rarity = action.toUpperCase();
      const pet = state.allPets.find((item) => item.rarity === rarity);
      if (pet) await playSummonReveal({ rarity, pet, mode: 'debug', results: [], reduceMotion: state.userPreferences?.reduceMotion ?? false });
    }
  });
}
