/**
 * Generic card-pool animation review page. Plays one pool's real entry, single pull, ten pull and
 * every SSR/UR character reveal through the App's own encounterCeremony modules and stylesheets,
 * using fixed results: no draw, wallet, collection or database access.
 *
 * Config (URL parameters override review-config.json next to the page):
 *   pool      pool ID to review (required)
 *   appRoot   path from this page to the App root (default "..")
 *   catalog   optional catalog.json URL (relative to appRoot); defaults to the App's own catalog
 *   auto      run the automatic checks on load
 */

// Presentation-only page: any database access is a bug and fails the checks.
let databaseAttempts = 0;
if (globalThis.indexedDB) {
  indexedDB.open = () => { databaseAttempts += 1; throw new Error('Database access is forbidden in the animation review page'); };
}

const main = document.getElementById('review');
const meta = document.getElementById('review-meta');
const params = new URL(location.href).searchParams;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const OVERLAYS = '.dream-debut-overlay, .dream-bloom-overlay, .summon-reveal-overlay, .awakening-scene, .ceremony-transition';
const RARITY_ORDER = ['N', 'R', 'SR', 'SSR', 'UR'];

async function loadConfig() {
  let file = {};
  try {
    const response = await fetch('review-config.json', { cache: 'no-store' });
    if (response.ok) file = await response.json();
  } catch { /* optional */ }
  const config = {
    pool: params.get('pool') || file.pool,
    appRoot: (params.get('appRoot') || file.appRoot || '..').replace(/\/+$/, ''),
    catalog: params.get('catalog') || file.catalog || null,
    auto: params.has('auto') || file.auto === true,
  };
  if (!config.pool) throw new Error('缺少 pool 參數（?pool=<卡池 ID>）');
  return config;
}

/** Use exactly the App's stylesheets, in the App's cascade order. */
async function loadAppStyles(appRoot) {
  const html = await (await fetch(`${appRoot}/index.html`, { cache: 'no-store' })).text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const hrefs = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.getAttribute('href'))
    .filter((href) => href && !/^[a-z]+:/i.test(href));
  // In App order, before this page's own small <style> so the review chrome stays readable.
  const anchor = document.head.querySelector('style');
  await Promise.all(hrefs.map((href) => new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${appRoot}/${href}`;
    link.onload = resolve;
    link.onerror = resolve;
    document.head.insertBefore(link, anchor);
  })));
  return hrefs.length;
}

async function loadCatalog({ appRoot, catalog }) {
  const getJson = async (relative) => {
    const response = await fetch(`${appRoot}/${relative}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`無法讀取 ${relative}（${response.status}）`);
    return response.json();
  };
  const { RELEASE_PROFILE } = await import(`${appRoot}/src/releaseProfile.js`);
  const artifact = RELEASE_PROFILE ? `${RELEASE_PROFILE.profile} artifact ${RELEASE_PROFILE.artifactId} · source ${RELEASE_PROFILE.sourceCommit.slice(0, 7)}` : '本機來源（非 artifact）';
  if (catalog) return { source: catalog, artifact, ...(await getJson(catalog)) };
  if (RELEASE_PROFILE?.contentBundleUrl) return { source: RELEASE_PROFILE.contentBundleUrl, artifact, ...(await getJson(RELEASE_PROFILE.contentBundleUrl)) };
  const [petsData, poolsData, loreData] = await Promise.all(['data/pets.json', 'data/pools.json', 'data/pets-lore.json'].map(getJson));
  return { source: 'data/*.json', artifact, petsData, poolsData, loreData };
}

/** Pet image paths are App-root relative; make them work from this page. */
function rebaseAssets(pet, appRoot) {
  const rebase = (value) => (typeof value === 'string' && value.startsWith('assets/') ? `${appRoot}/${value}` : value);
  const copy = { ...pet, image: rebase(pet.image) };
  if (pet.imageVariants) copy.imageVariants = Object.fromEntries(Object.entries(pet.imageVariants).map(([key, value]) => [key, rebase(value)]));
  return copy;
}

/** Fixed, deterministic showcase results; every SSR and UR appears and one duplicate is included. */
export function buildShowcase(pets) {
  const byRarity = Object.fromEntries(RARITY_ORDER.map((rarity) => [rarity, pets.filter((pet) => pet.rarity === rarity)]));
  const lowest = RARITY_ORDER.map((rarity) => byRarity[rarity][0]).find(Boolean);
  const result = (pet, isNew = true) => ({ pet, rarity: pet.rarity, isNew, fragmentsGained: isNew ? 0 : 1 });
  const featured = [...byRarity.UR, ...byRarity.SSR].slice(0, 6);
  const fillers = [...byRarity.N, ...byRarity.R, ...byRarity.SR];
  const ten = [];
  for (let index = 0; ten.length < 10 && index < 10; index += 1) {
    if (featured[index]) ten.push(result(featured[index]));
    if (ten.length < 10 && fillers.length) ten.push(result(fillers[index % fillers.length], index < fillers.length));
  }
  while (ten.length < 10) ten.push(result(lowest, false));
  return { single: [result(lowest)], ten: ten.slice(0, 10), characters: [...byRarity.UR, ...byRarity.SSR].map((pet) => result(pet)) };
}

const config = await loadConfig().catch((error) => { meta.textContent = error.message; meta.className = 'review__error'; throw error; });
const styleCount = await loadAppStyles(config.appRoot);
const catalog = await loadCatalog(config);
const ceremony = await import(`${config.appRoot}/src/encounterCeremony.js`);
const { mergeAllPetsWithLore } = await import(`${config.appRoot}/src/loreService.js`);
const { getEligiblePetsForPool } = await import(`${config.appRoot}/src/petPoolFilter.js`);
const { skipThemedSummon, isThemedSummonPlaying } = await import(`${config.appRoot}/src/themedSummonController.js`);
const { skipSummonReveal, isSummonRevealPlaying } = await import(`${config.appRoot}/src/summonRevealService.js`);
const { SUPPORTED_THEMES } = await import(`${config.appRoot}/src/themeRegistry.js`);

/** Same attributes the App sets (preferencesService.applyTheme), so theme tokens resolve. */
function applyTheme(theme) {
  for (const element of [document.documentElement, document.body]) {
    element.dataset.theme = theme;
    element.dataset.readingMode = 'normal';
  }
}
applyTheme(SUPPORTED_THEMES[0]);

const pool = catalog.poolsData.pools.find((row) => row.id === config.pool);
if (!pool) { meta.textContent = `找不到卡池 ${config.pool}（目錄：${catalog.source}）`; meta.className = 'review__error'; throw new Error('pool not found'); }
const allPets = mergeAllPetsWithLore(catalog.petsData.pets, catalog.loreData);
const pets = getEligiblePetsForPool(allPets, pool).map((pet) => rebaseAssets(pet, config.appRoot));
const showcase = buildShowcase(pets);
const presentation = ceremony.ceremonyPresentation(pool);

document.title = `${pool.name}｜動畫檢視`;
document.getElementById('review-title').textContent = `${pool.name}｜動畫檢視`;
meta.textContent = `卡池 ${pool.id} · 動畫 ${presentation.animationKey} · ${pets.length} 隻 · 目錄 ${catalog.source} · App 樣式 ${styleCount} 個 · ${catalog.artifact}。使用固定展示結果，不抽卡、不扣星塵、不寫入收藏。`;

const reduced = () => document.getElementById('reduce-motion').checked;
let busy = false;

function section(title, note, buttons) {
  const wrap = document.createElement('section');
  wrap.innerHTML = `<h2></h2>${note ? '<p></p>' : ''}<div class="review__group"></div>`;
  wrap.querySelector('h2').textContent = title;
  if (note) wrap.querySelector('p').textContent = note;
  for (const [label, run] of buttons) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => play(run));
    wrap.querySelector('.review__group').append(button);
  }
  return wrap;
}

async function play(run) {
  if (busy) return;
  busy = true;
  main.querySelectorAll('button').forEach((button) => { button.disabled = true; });
  // The overlays are translucent; keep review controls from showing through where the App has its pool page.
  main.style.visibility = 'hidden';
  try { await run(); } catch (error) { console.error(error); summary.textContent = `播放失敗：${error.message}`; }
  finally {
    busy = false;
    main.style.visibility = '';
    main.querySelectorAll('button').forEach((button) => { button.disabled = false; });
  }
}

/** The App's pull flow: ritual first, then each SSR/UR character in order unless skipped. */
async function playPull(results, reduceMotion = reduced()) {
  const ritual = await ceremony.playCeremonyRitual(pool, results, reduceMotion);
  const queue = results.filter((row) => ['SSR', 'UR'].includes(row.pet.rarity));
  const shown = [];
  if (!ritual.skipped) {
    const targets = results.length > 1 ? queue : results;
    for (const [index, row] of targets.entries()) {
      const character = await ceremony.playCeremonyCharacter(pool, row, { reduceMotion, index, count: targets.length });
      if (character.artworkShown) shown.push(row.pet.id);
      if (character.skipped) break;
    }
  }
  renderSummary(results);
  return { ritual, shown };
}

const summary = document.createElement('div');
function renderSummary(results) {
  summary.innerHTML = '<h2>結果順序（檢視頁摘要，不是 App 畫面）</h2><ol class="review__summary"></ol>';
  for (const row of results) {
    const item = document.createElement('li');
    item.textContent = `${row.pet.rarity} ${row.pet.name}${row.isNew ? '' : '（重複）'}`;
    summary.querySelector('ol').append(item);
  }
}

const toggle = document.createElement('label');
toggle.className = 'review__toggle';
toggle.innerHTML = '<input type="checkbox" id="reduce-motion"> 減少動態';
const themePicker = document.createElement('label');
themePicker.className = 'review__toggle';
themePicker.innerHTML = 'App 主題 <select id="review-theme"></select>';
for (const theme of SUPPORTED_THEMES) themePicker.querySelector('select').append(new Option(theme, theme));
themePicker.querySelector('select').addEventListener('change', (event) => applyTheme(event.target.value));
main.append(toggle, themePicker,
  section('登場', '首次進入與從選池列切換時，App 都播放同一段完整入場。', [
    ['完整登場', () => ceremony.playCeremonyEntry(pool, { reduceMotion: reduced() })],
    ['切換卡池入場', () => ceremony.playCeremonyEntry(pool, { reduceMotion: reduced() })],
  ]),
  section('召喚', '十連包含每隻 UR／SSR（最多 6 隻）與一個重複結果。', [
    ['單抽', () => playPull(showcase.single)],
    ['十連', () => playPull(showcase.ten)],
  ]),
  section('角色登場', null, showcase.characters.map((row) => [`${row.pet.rarity} ${row.pet.name}`,
    () => ceremony.playCeremonyCharacter(pool, row, { reduceMotion: reduced() })])),
  section('自動檢查', '一般與減少動態各跑一次，結果顯示在下方。', [['執行檢查', () => runChecks()]]),
  summary);
const output = document.createElement('pre');
output.className = 'review__results';
output.id = 'review-results';
main.append(output);
main.setAttribute('aria-busy', 'false');

/** Press whatever the visible overlay offers to move on, the way a hurried player would. */
async function driveUntil(pending, timeout = 30000) {
  let settled = false;
  let value;
  let failure;
  pending.then((result) => { settled = true; value = result; }, (error) => { settled = true; failure = error; });
  const started = performance.now();
  while (!settled) {
    if (performance.now() - started > timeout) throw new Error('演出在時限內沒有結束');
    const button = [...document.querySelectorAll(`${OVERLAYS.split(', ').map((selector) => `${selector} button`).join(', ')}, dialog[open] button`)]
      .find((candidate) => candidate.getClientRects().length && !candidate.disabled);
    if (button) button.click();
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await delay(120);
  }
  if (failure) throw failure;
  return value;
}

async function runChecks() {
  const cases = [];
  const check = async (name, run) => {
    try { await run(); cases.push({ name, ok: true }); }
    catch (error) { cases.push({ name, ok: false, error: String(error?.message || error) }); skipThemedSummon(); skipSummonReveal(); }
    output.textContent = JSON.stringify(cases, null, 2);
  };
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const clean = async () => {
    for (let index = 0; index < 50 && document.querySelector(OVERLAYS); index += 1) await delay(100);
    assert(!document.querySelector(OVERLAYS), '演出結束後仍留有遮罩');
    assert(!isThemedSummonPlaying() && !isSummonRevealPlaying(), '演出狀態沒有結束');
    assert(document.body.style.position !== 'fixed' && document.documentElement.style.overflow !== 'hidden', '捲動沒有恢復');
    assert(document.documentElement.scrollWidth <= innerWidth + 1, '出現水平捲動');
  };
  for (const reduceMotion of [false, true]) {
    const label = reduceMotion ? '減少動態' : '一般';
    await check(`${label}：完整登場可略過並清除`, async () => {
      const pending = ceremony.playCeremonyEntry(pool, { reduceMotion });
      for (let index = 0; index < 30 && !document.querySelector('.dream-debut-overlay'); index += 1) await delay(50);
      assert(document.querySelector('.dream-debut-overlay'), '沒有出現登場畫面');
      await driveUntil(pending);
      await clean();
    });
    for (const [mode, results] of [['單抽', showcase.single], ['十連', showcase.ten]]) {
      await check(`${label}：${mode}結束後結果不變`, async () => {
        const before = JSON.stringify(results.map((row) => row.pet.id));
        await driveUntil(playPull(results, reduceMotion));
        assert(JSON.stringify(results.map((row) => row.pet.id)) === before, '結果順序被改變');
        await clean();
      });
    }
  }
  for (const row of showcase.characters) {
    await check(`${row.pet.rarity} ${row.pet.name}：角色登場使用自己的卡圖`, async () => {
      const pending = ceremony.playCeremonyCharacter(pool, row, { reduceMotion: false });
      for (let index = 0; index < 40 && !document.querySelector('.summon-reveal-overlay'); index += 1) await delay(50);
      const overlay = document.querySelector('.summon-reveal-overlay');
      assert(overlay, '沒有出現角色登場');
      const image = overlay.querySelector('img');
      assert(image && image.getAttribute('src').includes(row.pet.id), '登場圖片不是這隻角色');
      await driveUntil(pending);
      await clean();
    });
  }
  await check('整個檢視頁沒有存取資料庫', async () => { assert(databaseAttempts === 0, `嘗試存取資料庫 ${databaseAttempts} 次`); });
  const passed = cases.filter((item) => item.ok).length;
  const report = { pool: pool.id, animationKey: presentation.animationKey, artifact: catalog.artifact, theme: document.body.dataset.theme, passed, failed: cases.length - passed, cases };
  output.textContent = JSON.stringify(report, null, 2);
  document.title = `${report.failed ? 'FAIL' : 'PASS'} — ${pool.name}動畫檢視`;
  globalThis.__poolAnimationReview = report;
  return report;
}

if (config.auto) await play(runChecks);
