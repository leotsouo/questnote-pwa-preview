import { invitationEntry, reencounterMoment, fragmentBalance, intimacySummary, createInvitationController } from './invitationPresentation.js';
import { invitationCandidates } from './encounterEconomyCore.js';
import { getPetSpecialty } from './expeditionGameplay.js';
import { initialAwakeningPortrait } from './petAwakeningView.js';
import { RARITIES, poolCandidates, identityLabel, basePetRate, publicIntro, normalGreeting, encounterResults } from './encounterViewModel.js';
import { normalizePoolDefinition, resolveActivePool } from './poolContentContract.js';
import { createPoolScenery, ceremonyPresentation, playCeremonyRitual, playCeremonyCharacter, playInvitationCharacter } from './encounterCeremony.js';
import { delay } from './imagePreloadService.js';
import { SUMMON_TIMING } from './summonTiming.js';
import { isSeniorMode, seniorFeedback, syncSeniorPresentation } from './seniorModeController.js';
import { LOCAL_ART_PREVIEW } from './localArtPreview.js';

const modalHost = document.createElement('div');
modalHost.className = 'encounter-dialogs';
modalHost.innerHTML = '<dialog id="identity-detail-dialog" class="identity-dialog" aria-labelledby="identity-dialog-heading"><div id="identity-dialog-content"></div></dialog><dialog id="identity-reveal-dialog" class="identity-dialog" aria-labelledby="identity-reveal-name"><div id="identity-reveal-content"></div></dialog><div id="identity-announcement" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>';
if (!LOCAL_ART_PREVIEW) document.body.append(modalHost);
const invitationDialog = document.createElement('dialog');
invitationDialog.className = 'identity-dialog invitation-dialog';
invitationDialog.id = 'specified-invitation-dialog';
if (!LOCAL_ART_PREVIEW) document.body.append(invitationDialog);
let invitationController = null;
let migrationShown = false;
let appState = null;
let resolvePresentation = null;

let screen = document.getElementById('identity-screen');
let refreshApp = null;
let appActions = null;
const dialog = modalHost.querySelector('#identity-detail-dialog');
const reveal = modalHost.querySelector('#identity-reveal-dialog');
const escapeHtml = (text) => String(text ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const asset = (pet, size = 'card') => new URL('../' + (pet.imageVariants?.[size] || pet.image), import.meta.url).href;
const byId = (id) => pets.find((pet) => pet.id === id);
let pets = [];
let canonicalPets = [];
let awakeningCatalog = null;
const previewForms = new Map();
let pools = [];
let poolId = 'standard';
let collectionScope = 'all';
let view = 'pool';
let collection = new Map();
let filter = 'all';
let density = 'compact';
let query = '';
let dialogOpener = null;
let revealOpener = null;
let revealFocusAction = '';
let detailReturnsToBatch = false;
let timers = [];
let activeResult = null;
let activeBatch = null;
let manual = false;
let displayBusy = false;
let trace = [];
const pool = () => pools.find((row) => row.id === poolId);
const candidates = () => poolCandidates(pets, pool(), isExpanded(poolId));
const owned = (pet) => collection.has(pet.id);
const collectionCandidates = () => collectionScope === 'all' ? pets : poolCandidates(pets, pools.find((row) => row.id === collectionScope), isExpanded(collectionScope));
const collectionScopeName = () => collectionScope === 'all' ? '全部系列' : pools.find((row) => row.id === collectionScope).name;
const presentation = () => isExpanded(poolId) && pool().unlockExpansion ? { ...pool().presentation, ...pool().unlockExpansion.presentation } : pool().presentation || {};
const featureIds = () => [presentation().heroPetId, ...(presentation().featuredPetIds || [])].filter(Boolean);
const isExpanded = (id) => appActions?.isExpanded(id) ?? !!appState?.poolUnlockState?.byPool?.[id]?.unlocked;
const reduced = () => isSeniorMode() || appState?.userPreferences?.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;

function imageHtml(pet, size = 'card', lazy = true, className = '') {
  return `<img class="${className}" src="${asset(pet, size)}" alt="" ${lazy ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async" data-fallback="${new URL('../' + pet.image, import.meta.url).href}">`;
}

function cues(pet, includeOwned = true) {
  return `<span class="identity-cue"><span class="rarity">${pet.rarity}</span>${includeOwned ? `<span>${owned(pet) ? '已相遇' : '尚未相遇'}</span>` : ''}</span>`;
}

function miniCard(pet, { showFeatured = false, grayscale = false, title = false } = {}) {
  return `<article class="collection-card ${grayscale && !owned(pet) ? 'unowned' : ''}"><button data-pet="${pet.id}" aria-label="${escapeHtml(identityLabel(pet, owned(pet)))}">
    ${imageHtml(pet)}<span class="pet-name">${escapeHtml(pet.name)}</span>${cues(pet)}
    ${title && pet.title ? `<span class="pet-title">${escapeHtml(pet.title)}</span>` : ''}
    ${showFeatured && featureIds().includes(pet.id) ? '<span class="subtle">焦點展示</span>' : ''}
  </button></article>`;
}

function poolSelector() {
  const isCollection = view === 'collection';
  const selected = isCollection ? collectionScope : poolId;
  const balance = (appState.wallet?.stardust || 0).toLocaleString('zh-TW');
  return `<div class="pool-select"><div class="pool-select-heading"><label for="identity-pool-select-${view}">${isCollection ? '瀏覽系列' : '探索世界'}</label>${isCollection ? '' : `<div class="summon-wallet" role="status" aria-live="polite" aria-atomic="true"><span>星塵總量</span><strong>${balance}</strong></div>`}</div><select ${appActions.isBusy() ? 'disabled' : ''} id="identity-pool-select-${view}">${isCollection ? '<option value="all">全部系列</option>' : ''}${pools.map((row) => `<option value="${row.id}" ${row.id === selected ? 'selected' : ''}>${escapeHtml(row.name)}</option>`).join('')}</select></div>`;
}

function renderPool() {
  screen = document.querySelector('#view-gacha .identity-surface') || screen;
  const selected = pool();
  const list = candidates();
  const hero = byId(presentation().heroPetId) || list.find((pet) => pet.rarity === 'UR') || list[0];
  const support = (presentation().featuredPetIds || list.filter((pet) => pet.rarity === 'UR' && pet.id !== hero.id).slice(0, 3).map((pet) => pet.id)).map(byId).filter((pet) => pet && list.some((row) => row.id === pet.id));
  screen.innerHTML = `<div class="page-intro pool-heading"><h1>${isSeniorMode() ? '召喚你的下一位夥伴' : '下一位同行者。'}</h1>${isSeniorMode() ? '<p class="page-description">完成任務獲得星塵，再用星塵隨機召喚夥伴。每一次相遇都會儲存在收藏。</p>' : ''}</div>
    ${poolSelector()}<section class="summon-sanctuary" data-world="${ceremonyPresentation(selected).animationKey}">
    <div class="sanctuary-scenery" aria-hidden="true"></div>
    <header class="sanctuary-heading"><h2>${escapeHtml(selected.name)}</h2><span>${escapeHtml(selected.presentation?.badge || '星光相遇')}</span></header>
    <div class="pool-layout"><div class="pool-stage"><button class="hero-card rank-${hero.rarity}" data-pet="${hero.id}" aria-label="預覽 ${escapeHtml(identityLabel(hero, owned(hero)))}">
      <span class="hero-portal">${imageHtml(hero, 'stage', false, 'hero-art')}</span>
      <span class="hero-caption"><span class="art-label">本池焦點 · 點擊認識</span><span class="pet-name">${escapeHtml(hero.name)}</span><span class="pet-title">${escapeHtml(hero.title)}</span>${cues(hero)}</span>
    </button><div class="summon-dock"><div class="summon-buttons"><button class="primary" ${appActions.isBusy() || appState.wallet.stardust < selected.cost ? 'disabled' : ''} data-identity-action="summon" data-pet-id="${hero.id}"><span>${isSeniorMode() ? '召喚 1 位夥伴' : '啟動相遇'}</span><small>單次 · ${selected.cost} 星塵</small></button><button ${appActions.isBusy() || appState.wallet.stardust < selected.cost * 10 ? 'disabled' : ''} data-identity-action="summon-ten"><span>${isSeniorMode() ? '召喚 10 次' : '十連相遇'}</span><small>十次 · ${selected.cost * 10} 星塵</small></button></div><p>${walletHint(selected)}</p></div></div></div></section>
    ${invitationEntry(appState.encounterEconomy?.balance || 0)}
    <div class="pool-copy"><p class="eyebrow">${escapeHtml(selected.presentation?.badge || '持續開放的相遇')}</p><h2>${escapeHtml(selected.name)}</h2>
      <p class="pool-lore">${escapeHtml(selected.presentation?.tagline || '循著星光，認識願意與你一起前進的夥伴。')}</p>
      <p class="subtle">${list.length} 位可相遇的夥伴 · 焦點展示不加成機率</p>
      ${selected.unlockExpansion ? `<p class="subtle">${isExpanded(poolId) ? '晨醒花庭已解鎖，候選名單已擴充。' : `此系列在累積 ${selected.unlockExpansion.threshold} 次召喚後開啟晨醒花庭；目前顯示初始名單。`}</p>` : ''}
      <div><button class="text-button" data-identity-action="preview">查看全部夥伴</button><br><button class="text-button" data-identity-action="probability">機率與卡池規則</button></div>
    </div>
    <div class="section-heading"><h2>也在這裡等你</h2><span class="subtle">焦點展示</span></div>
    <div class="support-grid">${support.slice(0, 3).map((pet) => `<button class="mini-card" data-pet="${pet.id}" aria-label="${escapeHtml(identityLabel(pet, owned(pet)))}">${imageHtml(pet)}<span class="pet-name">${escapeHtml(pet.name)}</span>${cues(pet)}</button>`).join('')}</div>
`;
  screen.querySelector('.sanctuary-scenery').append(createPoolScenery(selected));
  if (isSeniorMode()) {
    const dock = screen.querySelector('.summon-dock');
    screen.querySelector('.pool-select').after(dock);
  }
  syncSeniorPresentation();
}

function renderCollection() {
  screen = document.querySelector('#view-collection .identity-surface') || screen;
  const list = collectionCandidates();
  const count = list.filter(owned).length;
  screen.innerHTML = `<div class="page-intro"><div><p class="eyebrow">OUR ADVENTURE JOURNAL</p><h1>${isSeniorMode() ? '寵物與收藏' : '相遇，寫成旅程。'}</h1><p class="page-description">熟悉的夥伴，和還未寫下的故事。</p></div></div>${poolSelector()}
    <section class="collection-progress"><p><strong>${count} / ${list.length}</strong> <span class="subtle">位夥伴已相遇</span></p><p class="subtle">每次相遇，都留下一頁自己的記錄。</p><progress max="${list.length}" value="${count}" aria-label="${escapeHtml(collectionScopeName())}，${count} 位已相遇，共 ${list.length} 位"></progress></section>
    <section id="encounter-collection-milestones" class="collection-milestones-panel card" aria-label="收藏里程碑"></section>
    <div class="filters" aria-label="收藏狀態">${[['all','全部夥伴'],['owned','已相遇'],['unowned','尚未相遇']].map(([key,label]) => `<button data-filter="${key}" aria-pressed="${filter === key}">${label}</button>`).join('')}</div>
    <div class="filters" aria-label="卡片密度"><button data-density="compact" aria-pressed="${density === 'compact'}">精簡卡片</button><button data-density="expanded" aria-pressed="${density === 'expanded'}">展開卡片</button></div>
    <label class="search-label">尋找名字或稱號<input id="identity-collection-search" type="search" value="${escapeHtml(query)}" placeholder="輸入你記得的名字…"></label>
    <div id="identity-collection-results"></div>`;
  appActions.renderCollectionMilestones?.();
  renderCollectionCards();
  syncSeniorPresentation();
}

function renderCollectionCards() {
  const list = collectionCandidates().filter((pet) => (filter === 'all' || (filter === 'owned' ? owned(pet) : !owned(pet))) && `${pet.name} ${pet.title || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  document.getElementById('identity-collection-results').innerHTML = list.length ? `<p class="subtle" role="status" style="margin-top:16px">${list.length} 位夥伴 · 未相遇角色保留灰階預覽與名字</p><div class="collection-grid ${density === 'expanded' ? 'expanded' : ''}">${list.map((pet) => miniCard(pet, { grayscale: true, title: density === 'expanded' })).join('')}</div>` : `<section class="empty-state"><h2 role="status">這一頁還是空白。</h2><p class="subtle">試試其他名字或篩選，讓故事慢慢展開。</p><button data-identity-action="clear-filter">顯示全部夥伴</button></section>`;
}

function render() {
  view = document.getElementById('view-collection').classList.contains('active') ? 'collection' : 'pool';
  screen = document.querySelector(`#view-${view === 'pool' ? 'gacha' : 'collection'} .identity-surface`);
  if (!screen) return;
  view === 'pool' ? renderPool() : renderCollection();

}

function showDialog(heading, html) {
  if (!dialog.open) dialogOpener = document.activeElement;
  document.getElementById('identity-dialog-content').innerHTML = `<div class="dialog-header"><h2 id="identity-dialog-heading">${escapeHtml(heading)}</h2><button data-identity-action="close-dialog">關閉</button></div><div class="dialog-body">${html}</div>`;
  if (!dialog.open) dialog.showModal();
  dialog.querySelector('[data-identity-action="close-dialog"]').focus();
}

function keepDialogFocus(event) {
  if (event.key !== 'Tab') return;
  const modal = event.currentTarget;
  const controls = [...modal.querySelectorAll('button, a[href], input, select, textarea, summary, [tabindex]')].filter((control) => !control.disabled && control.tabIndex >= 0 && control.getClientRects().length && getComputedStyle(control).visibility !== 'hidden');
  const first = controls[0];
  const last = controls.at(-1);
  if (!first) return;
  if (event.shiftKey && (document.activeElement === first || document.activeElement === modal)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === modal)) {
    event.preventDefault();
    first.focus();
  }
}

function petDetail(pet, returnToBatch = false) {
  detailReturnsToBatch = returnToBatch;
  const entry = collection.get(pet.id);
  const isOwned = !!entry;
  const species = { griffin:'格里芬', biomechanical_chimera:'生體機械奇美拉' }[pet.speciesType] || '';
  const awakening = awakeningCatalog?.pets.find((row) => row.petId === pet.id);
  const form = previewForms.get(pet.id) || 'initial';
  const isAwakened = isOwned && !!appState.petAwakening?.byPet?.[pet.id]?.awakenedAt;
  const lockedAwakeningPreview = awakening && form === 'awakened' && !isAwakened;
  const official = canonicalPets.find((row) => row.id === pet.id) || pet;
  const artwork = awakening && form === 'awakened' ? awakening.awakenedImage ? { ...pet, image:awakening.awakenedImage.original, imageVariants:awakening.awakenedImage } : official : pet;
  showDialog(isOwned ? '夥伴手記' : '初識夥伴', `${imageHtml(artwork,'stage',false,`detail-art${lockedAwakeningPreview ? ' awakening-art-preview' : ''}`)}
    <div class="detail-identity"><h3 class="pet-name">${escapeHtml(pet.name)}</h3><p class="pet-title">${escapeHtml(pet.title)}</p>${cues(pet)}<p class="subtle" style="margin-top:10px">${escapeHtml([pet.element ? `${pet.element}屬性` : '',species].filter(Boolean).join(' · '))}</p></div>
    ${isOwned ? `<div class="companion-actions">${entry.nickname ? `<p class="subtle">你的稱呼：${escapeHtml(entry.nickname)} · 日常陪伴使用暱稱</p>` : ''}<button class="${entry.isCompanion ? '' : 'primary'}" data-identity-action="set-companion" data-pet-id="${pet.id}" ${entry.isCompanion ? 'disabled' : ''}>${entry.isCompanion ? '正在與你同行' : '設為陪伴'}</button><p class="subtle">切換後，首頁會顯示這位同行者。</p></div>` : ''}
    ${awakening ? `<section class="detail-section"><h3>羈絆覺醒 · ${isAwakened ? '形態欣賞' : '形態預覽'}</h3><p>目前${isAwakened ? '欣賞' : '預覽'}：${form === 'awakened' ? '覺醒相' : '初遇相'} · 覺醒後仍是同一位夥伴</p><div class="awakening-form-options"><button data-identity-action="awakening-form" data-pet-id="${pet.id}" data-form="initial" aria-pressed="${form === 'initial'}">初遇相</button><button data-identity-action="awakening-form" data-pet-id="${pet.id}" data-form="awakened" aria-pressed="${form === 'awakened'}">覺醒相${isAwakened ? '' : ' · 黑白預覽'}</button></div><p>${isAwakened ? '已完成覺醒，可欣賞兩種形態。' : '覺醒相以黑白預覽；完成羈絆覺醒後，揭曉全彩造型與專屬演出。'}</p></section>` : ''}
    <p class="detail-copy">${escapeHtml(isOwned ? pet.lore : publicIntro(pet))}</p>
    ${isOwned ? intimacySummary(entry.bondLevel, getPetSpecialty({ ...pet, ...entry }), entry.legacySpecialtyFloor) : ''}
    ${isOwned && pet.personality?.length ? `<section class="detail-section"><h3>認識牠的個性</h3><p>${escapeHtml(pet.personality.join(' · '))}</p>${normalGreeting(pet) ? `<blockquote>${escapeHtml(normalGreeting(pet))}</blockquote>` : ''}</section>` : ''}
    <section class="detail-section"><h3>相處，才會揭開的故事</h3>${isOwned ? [2,3,4,5].map((level) => `<p>親密度 Lv.${level} · ${entry.bondLevel >= level ? escapeHtml(pet.bondUnlocks?.[level] || '已解鎖') : '故事尚未解鎖'}</p>`).join('') : '<p>相遇後可閱讀完整背景；專屬對話與羈絆章節隨親密度逐步揭開。</p>'}</section>
    ${isOwned ? `<section class="detail-section"><h3>一起走下去</h3><button data-identity-action="app-pet-detail" data-pet-id="${pet.id}">養成與餵食</button><button data-identity-action="app-nickname" data-pet-id="${pet.id}">修改暱稱</button><p>在完整 App 的養成頁，可以修改暱稱、餵食、培養親密度與閱讀同行故事。</p></section>` : `<section class="detail-section"><p>你可以先記住牠的名字，讓下一次相遇更熟悉。</p></section>`}<button class="text-button" data-identity-action="${returnToBatch ? 'return-batch' : view === 'collection' ? 'close-dialog' : 'preview'}">${returnToBatch ? '返回本次相遇' : view === 'collection' ? '返回圖鑑' : '返回本池夥伴'}</button>`);
  if (isSeniorMode()) {
    // Keep care actions visible; optional narrative uses disclosure, not another data model.
    dialog.querySelectorAll('.detail-section').forEach((section) => {
      const heading = section.querySelector('h3');
      if (!heading || section.querySelector('button')) return;
      const details = document.createElement('details');
      details.className = 'senior-form-options';
      const summary = document.createElement('summary');
      summary.textContent = heading.textContent;
      heading.remove();
      section.replaceWith(details);
      details.append(summary, section);
    });
  }
}

function poolPreview() {
  showDialog('這裡可以遇見誰', `<p class="subtle">${escapeHtml(pool().name)} · ${candidates().length} 位夥伴</p><p class="subtle">焦點只是介紹，不代表機率加成。</p><button class="text-button" data-identity-action="probability">查看機率與規則</button><div class="preview-grid">${candidates().map((pet) => miniCard(pet, {showFeatured:true})).join('')}</div>`);
}

function probability() {
  const selected = pool();
  const list = candidates();
  showDialog('機率與卡池規則', `<p class="subtle">${escapeHtml(selected.name)} · 相遇規則</p><table class="rate-table"><caption>一般召喚基礎機率（不含保底與十連保障）</caption><thead><tr><th scope="col">稀有度</th><th scope="col">機率</th><th scope="col">角色數</th></tr></thead><tbody>${RARITIES.map((rarity) => `<tr><th scope="row">${rarity}</th><td>${(selected.rates[rarity] * 100).toFixed(0)}%</td><td>${list.filter((pet) => pet.rarity === rarity).length}</td></tr>`).join('')}</tbody></table>
    <p class="probability-note">先選稀有度，再於同稀有度候選中等機率選取。焦點夥伴沒有另加權；不是 Rate-Up。</p>
    <p class="probability-note">SSR 或 UR 保底上限 ${selected.pity.ssr} 抽：若前 ${selected.pity.ssr - 1} 抽都未得到 SSR 或 UR，第 ${selected.pity.ssr} 抽必為 SSR 或 UR（依兩者基礎比例分配）。UR 保底上限 ${selected.pity.ur} 抽：若前 ${selected.pity.ur - 1} 抽都未得到 UR，第 ${selected.pity.ur} 抽必為 UR。各池獨立計數。得到 UR 時兩種計數歸零；SSR 只重設 SSR 計數。</p>
    ${selected.tenPullGuarantee === 'SR' ? '<p class="probability-note">十連相遇至少獲得一位 SR 或以上夥伴。若前九位都只有 N／R，第十位原本為 N／R 時提升為 SR；SSR 與 UR 保底優先，不降低已抽到的稀有度。十次分開單抽不適用這項十連保障。</p>' : ''}
    <p class="probability-note">單次 ${selected.cost} 星塵；十連 ${selected.cost * 10} 星塵。相遇會扣除實際星塵。</p>
    ${selected.unlockExpansion ? `<p class="probability-note">原有花庭擴充：${selected.unlockExpansion.threshold} 次召喚後解鎖，候選名單與贈寵依正式規則；解鎖後自動擴充名單並發放一次獎勵。</p>` : ''}
    <details style="margin-top:18px"><summary>每隻夥伴的基礎機率</summary><table class="rate-table"><thead><tr><th scope="col">名字</th><th scope="col">機率</th></tr></thead><tbody>${list.map((pet) => `<tr><th scope="row">${escapeHtml(pet.name)}</th><td>${(basePetRate(pet,list,selected)*100).toLocaleString('en',{maximumFractionDigits:4})}%</td></tr>`).join('')}</tbody></table></details>`);
}

function clearTimers() { timers.forEach(clearTimeout); timers = []; }

function phase(name) {
  const shell = document.querySelector('.reveal-shell');
  if (!shell) return;
  shell.dataset.phase = name;
  trace.push({ phase: name, at: Math.round(performance.now() - Number(shell.dataset.start)) });
  shell.dataset.trace = JSON.stringify(trace);
  // The dialog's accessible name follows the same recognition order as its art.
  reveal.removeAttribute('aria-labelledby');
  reveal.setAttribute('aria-label', name === 'name' ? `${activeResult.pet.name}，${activeResult.pet.rarity}` : name === 'title' ? [activeResult.pet.name, activeResult.pet.title, activeResult.pet.rarity].filter(Boolean).join('，') : name === 'result' ? identityLabel(activeResult.pet, true) : '夥伴相遇演出');
  shell.querySelector('.pet-name').setAttribute('aria-hidden', !['name','title','result'].includes(name));
  shell.querySelector('.pet-title').setAttribute('aria-hidden', !['title','result'].includes(name));
  shell.querySelector('.reveal-actions').setAttribute('aria-hidden', name !== 'result');
  shell.querySelector('.obtained').setAttribute('aria-hidden', name !== 'result');
  const greeting = shell.querySelector('.reveal-greeting');
  if (greeting) greeting.hidden = name !== 'result';
  shell.querySelector('.reveal-stage-label').textContent = {begin:'循著星光，等待相遇',cue:`${activeResult.pet.rarity} · 相遇的微光`,silhouette:'一位夥伴正在靠近',art:'牠已經來到你面前',name:'記住這位同行者',title:'名字背後，是牠的故事',result:activeResult.isNew?'新的旅程，從這裡開始':'熟悉的夥伴，再次相遇'}[name];
  if (name === 'name' && !reduced() && appState?.userPreferences?.haptics && navigator.vibrate) {
    navigator.vibrate({N:8,R:12,SR:16,SSR:18,UR:[20,30,12]}[activeResult.pet.rarity]);
  }
  if (name === 'result') {
    clearTimers();
    shell.querySelector('[data-identity-action="skip-reveal"]').textContent = activeBatch ? '略過全部' : isSeniorMode() ? '收下，返回召喚' : '關閉';
    document.getElementById('identity-announcement').textContent = `${activeResult.pet.name}，${activeResult.pet.title || ''}，${activeResult.pet.rarity}。${activeResult.isNew ? '新夥伴已加入圖鑑。' : `再次相遇，相遇碎片增加 ${activeResult.fragmentsGained}，目前 ${activeResult.encounterBalanceAfter ?? appState.encounterEconomy?.balance ?? 0} 枚。`}`;
    shell.querySelector('.reveal-actions').removeAttribute('aria-hidden');
    shell.querySelector('.obtained').removeAttribute('aria-hidden');
  }
}

function rememberRevealOpener() {
  revealOpener = document.activeElement;
  revealFocusAction = revealOpener?.dataset?.identityAction || '';
  if (dialog.open) dialog.close();
}

function presentResult(result, stepByStep = false, artworkShown = false) {
  clearTimers();
  activeResult = result;
  const pet = result.pet;
  manual = stepByStep;
  trace = [];
  document.getElementById('identity-reveal-content').innerHTML = `<section class="reveal-shell rank-${pet.rarity}" data-phase="begin" style="--next-character-duration:${SUMMON_TIMING.nextCharacter}ms" data-start="${performance.now()}">
    <div class="reveal-top"><p class="eyebrow reveal-stage-label">循著星光，等待相遇</p><button data-identity-action="skip-reveal">${activeBatch ? '略過全部' : '略過演出'}</button></div>
    ${activeBatch ? `<p class="queue-progress">本次相遇 · 角色揭露 ${activeBatch.index + 1} / ${activeBatch.queue.length}</p>` : ''}
    <div class="reveal-art">${imageHtml(pet,'stage',false,'reveal-image')}</div><div class="reveal-identity"><h2 id="identity-reveal-name" class="pet-name" aria-hidden="true">${escapeHtml(pet.name)}</h2><p class="pet-title" aria-hidden="true">${escapeHtml(pet.title)}</p>${cues(pet,false)}</div>
    ${result.isNew && normalGreeting(pet) ? `<blockquote class="reveal-greeting" hidden>「${escapeHtml(normalGreeting(pet))}」</blockquote>` : ''}
    <div class="obtained" aria-hidden="true">${result.isNew ? '初次相遇，已加入圖鑑。<p>從相遇開始，讓故事慢慢變熟悉。</p>' : reencounterMoment(pet, result.fragmentsGained, result.encounterBalanceAfter ?? appState.encounterEconomy?.balance ?? 0)}</div>
    <div class="reveal-actions" aria-hidden="true">${activeBatch ? `<button class="primary" data-identity-action="next-result">${activeBatch.index + 1 === activeBatch.queue.length ? '查看本次相遇' : '下一位夥伴'}</button><button data-identity-action="batch-summary">查看全部結果</button>` : `<button class="primary" data-identity-action="reveal-detail">${isSeniorMode() ? '查看夥伴' : '認識這位夥伴'}</button><button data-identity-action="reveal-collection">查看圖鑑</button>`}</div>
    ${manual ? `<div class="filters" aria-label="逐步檢視演出">${['begin','cue','silhouette','art','name','title','result'].map((key,index) => `<button data-phase-step="${key}">${index+1} ${['開始','稀有線索','輪廓','插畫','名字','稱號','結果'][index]}</button>`).join('')}</div>` : ''}
  </section>`;
  if (!reveal.open) reveal.showModal();
  reveal.scrollTop = 0;
  reveal.querySelector('[data-identity-action="skip-reveal"]').focus();
  phase(reduced() ? 'result' : artworkShown ? 'art' : 'begin');
  if (!reduced() && !manual) {
    (artworkShown ? [['name',300],['title',650],['result',1000]] : [['cue',300],['silhouette',550],['art',850],['name',1200],['title',1450],['result',1800]]).forEach(([key,delay]) => timers.push(setTimeout(() => phase(key),delay)));
  }
}

// Only the native UI can call this after its atomic draw has committed.
export async function presentCommittedEncounters(selectedPool, results) {
  if (!results.length) throw new Error('Missing committed encounter results');
  poolId = selectedPool.id;
  rememberRevealOpener();
  const list = encounterResults(results, collection);
  const completed = new Promise((resolve) => { resolvePresentation = resolve; });
  displayBusy = true;
  activeBatch = list.length > 1 ? { results: list, queue: list.filter((row) => ['SSR', 'UR'].includes(row.pet.rarity)), index: 0, summary: false } : null;
  try {
    activationHaptic();
    if (isSeniorMode()) {
      if (activeBatch) showBatchSummary();
      else presentResult(list[0]);
    } else if (reduced() && activeBatch) showBatchSummary();
    else {
      const ritual = await playCeremonyRitual(selectedPool, list, reduced());
      if (activeBatch) {
        activeBatch.ritualDuration = ritual.duration;
        if (ritual.skipped || !activeBatch.queue.length) showBatchSummary();
        else await presentBatchCharacter();
      } else {
        const character = ritual.skipped ? {} : await playCeremonyCharacter(selectedPool, list[0], { reduceMotion: reduced() });
        presentResult(list[0], false, character.artworkShown);
        if (ritual.skipped || character.skipped) phase('result');
      }
    }
  } catch (error) {
    console.warn('[Encounter] Ceremony failed; showing committed results', error);
    if (activeBatch) showBatchSummary();
    else { presentResult(list[0]); phase('result'); }
  } finally { displayBusy = false; }
  return completed;
}

function showBatchSummary() {
  if (!activeBatch) return;
  clearTimers();
  activeBatch.summary = true;
  const count = activeBatch.results.filter((result) => result.isNew).length;
  document.getElementById('identity-reveal-content').innerHTML = `<section class="batch-summary"><div class="dialog-header"><h2 id="identity-batch-heading">本次相遇</h2><button data-identity-action="close-reveal">關閉</button></div><div class="dialog-body"><p class="batch-lead">${count} 位初次相遇 · 10 次旅程記錄</p><p class="subtle">點擊任一夥伴，認識牠的故事。</p><div class="batch-grid">${activeBatch.results.map((result, index) => `<article class="batch-card ${result.isNew ? 'first-encounter' : ''}"><button data-result-pet="${result.pet.id}" aria-label="第 ${index + 1} 位，${escapeHtml(identityLabel(result.pet, true))}，${result.isNew ? '初次相遇' : `再次相遇，相遇碎片增加 ${result.fragmentsGained}`}，"><span class="encounter-index">${String(index + 1).padStart(2, '0')}</span>${imageHtml(result.pet)}<span class="pet-name">${escapeHtml(result.pet.name)}</span><span class="identity-cue"><span class="rarity">${result.pet.rarity}</span></span><span class="encounter-state">${result.isNew ? '初次相遇' : '再次相遇'}</span>${result.isNew ? '' : `<span class="fragment-gain">相遇碎片 +${result.fragmentsGained}</span>`}</button></article>`).join('')}</div>${fragmentBalance(activeBatch.results.at(-1).encounterBalanceAfter ?? appState.encounterEconomy?.balance ?? 0)}<div class="batch-actions"><button class="primary" data-identity-action="reveal-collection">查看圖鑑</button><button data-identity-action="close-reveal">返回卡池</button></div></div></section>`;
  reveal.removeAttribute('aria-label');
  reveal.setAttribute('aria-labelledby', 'identity-batch-heading');
  if (!reveal.open) reveal.showModal();
  reveal.scrollTop = 0;
  reveal.querySelector('[data-identity-action="close-reveal"]').focus();
  document.getElementById('identity-announcement').textContent = `十連相遇完成，共 10 位結果，${count} 位初次相遇。所有結果已加入圖鑑。`;
}

function finishPresentation() {
  if (activeBatch) showBatchSummary();
  else phase('result');
}

function closeReveal() { clearTimers(); reveal.close(); activeBatch = null; const resolve = resolvePresentation; resolvePresentation = null; resolve?.(); render(); }

function activationHaptic() {
  if (!reduced() && appState?.userPreferences?.haptics && navigator.vibrate) navigator.vibrate(12);
}

async function presentBatchCharacter() {
  if (!activeBatch) return;
  const batch = activeBatch;
  if (reveal.open && !reduced()) {
    reveal.querySelectorAll('.reveal-actions button').forEach((button) => { button.disabled = true; });
    reveal.querySelector('.reveal-shell')?.classList.add('is-leaving');
    await delay(SUMMON_TIMING.nextCharacter);
    if (activeBatch !== batch || batch.summary) return;
  }
  const curtain = document.createElement('div');
  curtain.className = 'ceremony-transition';
  curtain.setAttribute('aria-hidden','true');
  document.body.append(curtain);
  if (reveal.open) reveal.close();
  try {
    const result = batch.queue[batch.index];
    const character = await playCeremonyCharacter(pool(), result, { reduceMotion: reduced(), index: batch.index, count: batch.queue.length });
    if (activeBatch !== batch || batch.summary) return;
    character.skipped ? showBatchSummary() : presentResult(result, false, character.artworkShown);
    if (!character.skipped) document.querySelector('.reveal-shell').dataset.characterDuration = String(character.duration || 0);
    if (!character.skipped) document.querySelector('.reveal-shell').dataset.ritualDuration = String(batch.ritualDuration || 0);
  } finally { curtain.remove(); }
}

document.addEventListener('error', (event) => {
  const img = event.target;
  if (img instanceof HTMLImageElement && img.dataset.fallback && img.src !== img.dataset.fallback) img.src = img.dataset.fallback;
},true);

document.addEventListener('click', async (event) => {
  if (LOCAL_ART_PREVIEW) return;
  if (!event.target.closest('.identity-surface, .identity-dialog, .identity-review')) return;
  const surface = event.target.closest('.identity-surface');
  if (surface) { screen = surface; view = surface.closest('#view-collection') ? 'collection' : 'pool'; }
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.collectionMilestoneAction) return;

  if (button.dataset.pet) { petDetail(byId(button.dataset.pet)); return; }
  if (button.dataset.resultPet) { petDetail(byId(button.dataset.resultPet), true); return; }
  if (button.dataset.filter) { filter = button.dataset.filter; renderCollection(); return; }
  if (button.dataset.density) { density = button.dataset.density; renderCollection(); return; }
  if (button.dataset.phaseStep) { phase(button.dataset.phaseStep); return; }
  const action = button.dataset.identityAction;
  if (action === 'app-pet-detail' || action === 'app-nickname') { dialog.close(); if (reveal.open) closeReveal(); action === 'app-pet-detail' ? appActions.openPetDetail(button.dataset.petId) : appActions.openNickname(button.dataset.petId); return; }
  if (action === 'invitation') openInvitation();
  if (action === 'preview') poolPreview();
  if (action === 'probability') probability();
  if (action === 'close-dialog') dialog.close();
  if (action === 'summon') await runDraw(1);
  if (action === 'summon-ten') await runDraw(10);
  if (action === 'awakening-form') {
    previewForms.set(button.dataset.petId, button.dataset.form);
    petDetail(byId(button.dataset.petId), detailReturnsToBatch);
    dialog.querySelector(`[data-form="${button.dataset.form}"]`)?.focus();
  }
  if (action === 'skip-reveal') activeBatch ? showBatchSummary() : document.querySelector('.reveal-shell').dataset.phase === 'result' ? closeReveal() : phase('result');
  if (action === 'batch-summary') showBatchSummary();
  if (action === 'next-result' && activeBatch) {
    if (displayBusy) return;
    displayBusy = true;
    activeBatch.index += 1;
    try { activeBatch.index < activeBatch.queue.length ? await presentBatchCharacter() : showBatchSummary(); } finally { displayBusy = false; }
  }
  if (action === 'close-reveal') closeReveal();
  if (action === 'return-batch') dialog.close();
  if (action === 'set-companion') {
    button.disabled = true;
    await appActions.setCompanion(button.dataset.petId);
    seniorFeedback(`${byId(button.dataset.petId).name}已設為陪伴夥伴。`, 'success');
    render();
    petDetail(byId(button.dataset.petId), detailReturnsToBatch);
    document.getElementById('identity-announcement').textContent = `${byId(button.dataset.petId).name}已設為陪伴夥伴。`;
  }
  if (action === 'reveal-detail') { const pet = activeResult.pet; closeReveal(); petDetail(pet); }
  if (action === 'reveal-collection') { filter = 'all'; query = ''; closeReveal(); appActions.switchView('collection'); screen.focus(); }
  if (action === 'clear-filter') { filter = 'all'; query = ''; renderCollection(); }
});

document.addEventListener('change', (event) => {
  if (LOCAL_ART_PREVIEW) return;
  if (event.target.id.startsWith('identity-pool-select-')) {
    if (displayBusy) { event.target.value = event.target.id === 'identity-pool-select-collection' ? collectionScope : poolId; return; }
    if (event.target.id === 'identity-pool-select-collection') collectionScope = event.target.value;
    else { void appActions.selectPool(event.target.value); return; }
    query = ''; render();
  }
});
document.addEventListener('input', (event) => {
  if (LOCAL_ART_PREVIEW) return;
  if (event.target.id === 'identity-collection-search') { query = event.target.value; renderCollectionCards(); }
});
dialog.addEventListener('close', () => {
  if (reveal.open && !activeBatch?.summary) return;
  if (dialogOpener?.isConnected) dialogOpener.focus();
  else if (reveal.open) reveal.querySelector('button').focus();
  else screen.focus();
});
dialog.addEventListener('keydown', keepDialogFocus);
reveal.addEventListener('keydown', keepDialogFocus);
reveal.addEventListener('cancel', (event) => {
  event.preventDefault();
  if (activeBatch) activeBatch.summary ? closeReveal() : showBatchSummary();
  else document.querySelector('.reveal-shell').dataset.phase === 'result' ? closeReveal() : phase('result');
});
reveal.addEventListener('close', () => {
  clearTimers();
  if (dialog.open) return;
  const target = revealOpener?.isConnected ? revealOpener : revealFocusAction ? screen.querySelector(`[data-identity-action="${revealFocusAction}"]`) : null;
  (target || screen).focus();
});
export function renderEncounterView(name, state, refresh, actions) {
  if (!state?.allPets?.length || !state?.poolsData?.pools?.some((row) => row.active)) return false;
  appState = state;
  poolId = resolveActivePool(state.poolsData, state.gachaStats?.selectedPoolId).id;
  document.body.dataset.reduceMotion = String(!!state.userPreferences?.reduceMotion);
  refreshApp = refresh;
  appActions = actions;
  canonicalPets = state.allPets;
  awakeningCatalog = state.awakeningCatalog;
  pets = state.allPets.map((pet) => initialAwakeningPortrait(pet, state.awakeningCatalog));
  pools = state.poolsData.pools.filter((row) => row.active).map(normalizePoolDefinition);
  collection = new Map(state.enrichedCollection.filter((pet) => pet.owned).map((pet) => [pet.id, {
    petId:pet.id, legacySpecialtyFloor:pet.legacySpecialtyFloor, encounterMigrationVersion:pet.encounterMigrationVersion, bondExp:pet.bondExp, bondLevel:pet.bondLevel,
    isCompanion: pet.isCompanion, nickname: pet.nickname, obtainedAt: pet.obtainedAt, lastPettedAt: pet.lastPettedAt,
  }]));
  if (!migrationShown && state.encounterEconomy?.migrationReceipt && !state.encounterEconomy.migrationReceipt.acknowledgedAt) {
    migrationShown = true;
    queueMicrotask(() => openInvitation('migration'));
  }
  const host = document.getElementById('view-' + name);
  let target = host.querySelector('.identity-surface');
  if (!target) {
    [...host.children].forEach((child) => { child.hidden = true; });
    target = document.createElement('section');
    target.className = 'identity-surface';
    target.tabIndex = -1;
    host.append(target);
  }
  screen = target;
  const nextView = name === 'gacha' ? 'pool' : 'collection';
  const current = view;
  view = nextView;
  nextView === 'pool' ? renderPool() : renderCollection();
  view = document.getElementById('view-' + name).classList.contains('active') ? nextView : current;
  screen = document.querySelector('#view-' + (view === 'pool' ? 'gacha' : 'collection') + ' .identity-surface') || target;
  return true;
}

async function runDraw(count) {
  if (displayBusy || appActions.isBusy()) return;
  displayBusy = true;
  screen.querySelectorAll('[data-identity-action="summon"], [data-identity-action="summon-ten"], select').forEach((control) => { control.disabled = true; });
  try { await appActions.draw(count); }
  finally { displayBusy = false; render(); }
}

function walletHint(selected) {
  if (isSeniorMode()) return `你有 ${appState.wallet?.stardust || 0} 星塵。${appState.wallet?.stardust < selected.cost ? '星塵不足時，可以先回首頁完成任務。' : '按下召喚後，還可以先確認費用。'}稀有度與保底規則可在下方查看。`;
  const counters = appState.gachaStats?.poolPity?.[selected.id] || {};
  return '持有 ' + (appState.wallet?.stardust || 0) + ' 星塵 · SSR+ 保底 ' + (counters.ssrPity || 0) + '/' + selected.pity.ssr + ' · UR 保底 ' + (counters.urPity || 0) + '/' + selected.pity.ur;
}

function openInvitation(route = 'gallery') {
  const model = () => ({ route, balance:appState.encounterEconomy?.balance || 0, reduceMotion:reduced(),
    rows:invitationCandidates(pets, appState.poolsData, appState.poolUnlockState, [...collection.values()]),
    receipt:appState.encounterEconomy?.migrationReceipt, names:new Map(pets.map((pet) => [pet.id, pet.name])) });
  if (!invitationController) invitationController = createInvitationController(invitationDialog, {
    invite:(id) => appActions.invite(id), setCompanion:(id) => appActions.setCompanion(id),
    playArrival:({ selected, reduceMotion }) => playInvitationCharacter(pools, selected, { reduceMotion }),
    dismissMigration:() => appActions.dismissMigration(),
    refreshModel(current) { const fresh = model(); const id = current.selected?.pet.id; Object.assign(current, { balance:fresh.balance, rows:fresh.rows, selected:fresh.rows.find((row) => row.pet.id === id) }); },
  });
  invitationController.open(model());
}
