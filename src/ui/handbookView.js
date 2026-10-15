/**
 * Adventure handbook view (V2.9.0): read-only summary of existing progress.
 * Section expand/collapse state lives in memory only, never in IndexedDB or backups.
 */
import { getAdventureHandbookSummary } from '../adventureHandbookService.js';
import { escapeHtml } from '../uiHelpers.js';

// Bound from src/ui.js by connectHandbookView() so this module never imports ui.js back.
let isAnyOverlayOpen, petImageHtml, state, switchView, uiDebugLog;

export function connectHandbookView(deps) {
  ({ isAnyOverlayOpen, petImageHtml, state, switchView, uiDebugLog } = deps);
}

/* ============================================================ *
 * 冒險手冊 View（V2.9.0）
 * 唯讀整合現有資料，詳細區塊預設收合。
 * ============================================================ */

/** 詳細區塊展開狀態（模組級，不入 IndexedDB / 備份；重啟 PWA 後回到預設收合） */
const handbookSectionState = {
  weekly: false,
  records: false,
  companions: false,
  expedition: false,
};

/** 最近一次計算出的手冊模型（同一 App session 內快取，供回到手冊時即時顯示） */
let handbookModel = null;
let handbookRefreshing = false;

function isHandbookActive() {
  return document.getElementById('view-handbook')?.classList.contains('active') ?? false;
}

/** 進入手冊或需要刷新時呼叫：先以現有模型即時渲染，再抓最新時效資料局部刷新 */
export function renderHandbookView() {
  const container = document.getElementById('handbook-content');
  if (!container) return;
  if (handbookModel) {
    container.innerHTML = buildHandbookHtml(handbookModel);
  } else {
    container.innerHTML = '<p class="handbook-loading">整理你的冒險成果中…</p>';
  }
  // 只在使用者正停留於手冊、且無 Overlay 時重新生成摘要，避免不必要的背景 render
  if (isHandbookActive() && !isAnyOverlayOpen()) {
    refreshHandbookModel();
  }
}

/** 僅重繪目前模型（不重新抓資料），用於收合切換等純 UI 操作 */
function rerenderHandbookContent() {
  const container = document.getElementById('handbook-content');
  if (!container || !handbookModel) return;
  container.innerHTML = buildHandbookHtml(handbookModel);
}

async function refreshHandbookModel() {
  if (handbookRefreshing) return;
  handbookRefreshing = true;
  try {
    const model = await getAdventureHandbookSummary(state || {});
    handbookModel = model;
    if (isHandbookActive() && !isAnyOverlayOpen()) {
      const container = document.getElementById('handbook-content');
      if (container) container.innerHTML = buildHandbookHtml(model);
    }
  } catch (err) {
    uiDebugLog('[Handbook] refresh failed:', err);
  } finally {
    handbookRefreshing = false;
  }
}

export function handleHandbookClick(e) {
  const backBtn = e.target.closest('[data-goto]');
  if (backBtn) {
    switchView(backBtn.dataset.goto);
    return;
  }
  const toggle = e.target.closest('[data-action="handbook-toggle"]');
  if (toggle) {
    const key = toggle.dataset.section;
    if (key && key in handbookSectionState) {
      handbookSectionState[key] = !handbookSectionState[key];
      rerenderHandbookContent();
    }
    return;
  }
  const goto = e.target.closest('[data-action="handbook-goto"]');
  if (goto?.dataset.view) {
    switchView(goto.dataset.view);
  }
}

/* ---------- HTML builders ---------- */

function handbookProgressBar(percent) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return `<span class="handbook-progress" role="presentation"><span class="handbook-progress__fill" style="width:${pct}%"></span></span>`;
}

function buildHandbookQuickStats(quickStats) {
  if (!Array.isArray(quickStats) || quickStats.length === 0) {
    return `<section class="handbook-summary card" aria-label="成長摘要">
      <p class="handbook-empty">開始完成任務與收集夥伴，這裡就會顯示你的成長摘要。</p>
    </section>`;
  }
  const cards = quickStats.map((s) => `
    <button class="handbook-stat" type="button" data-action="handbook-goto" data-view="${escapeHtml(s.actionView || 'tasks')}">
      <span class="handbook-stat__icon" aria-hidden="true">${escapeHtml(s.icon || '✦')}</span>
      <span class="handbook-stat__label">${escapeHtml(s.label)}</span>
      <span class="handbook-stat__value">${escapeHtml(String(s.value))}</span>
    </button>`).join('');
  return `<section class="handbook-summary card" aria-label="成長摘要">
    <div class="handbook-summary__grid">${cards}</div>
  </section>`;
}

function buildHandbookGoals(goals) {
  const head = '<h2 class="handbook-goals__title">下一步目標</h2>';
  if (!Array.isArray(goals) || goals.length === 0) {
    return `<section class="handbook-goals card" aria-label="下一步目標">
      ${head}
      <p class="handbook-empty">目前沒有進行中的目標，繼續你的冒險就會出現新的挑戰！</p>
    </section>`;
  }
  const cards = goals.map((g) => {
    const unit = g.unit || '';
    const pct = g.target > 0 ? (g.current / g.target) * 100 : (g.status === 'claimable' ? 100 : 0);
    const claimable = g.status === 'claimable';
    const chip = claimable
      ? '<span class="handbook-chip handbook-chip--claimable"><span aria-hidden="true">✓</span> 可領取</span>'
      : '';
    const curDisp = Number.isFinite(g.current) ? Math.min(g.current, g.target) : g.current;
    const count = Number.isFinite(g.current) && Number.isFinite(g.target) && g.target > 0
      ? `<span class="handbook-goal__count">${escapeHtml(String(curDisp))}${escapeHtml(unit)} / ${escapeHtml(String(g.target))}${escapeHtml(unit)}</span>`
      : '';
    return `
    <button class="handbook-goal${claimable ? ' handbook-goal--claimable' : ''}" type="button" data-action="handbook-goto" data-view="${escapeHtml(g.actionView || 'tasks')}">
      <span class="handbook-goal__icon" aria-hidden="true">${escapeHtml(g.icon || '✦')}</span>
      <span class="handbook-goal__body">
        <span class="handbook-goal__title-row">
          <span class="handbook-goal__name">${escapeHtml(g.title || '目標')}</span>
          ${chip}
        </span>
        <span class="handbook-goal__meta">
          ${handbookProgressBar(pct)}
          ${count}
        </span>
        <span class="handbook-goal__hint">${escapeHtml(g.hint || '')}</span>
      </span>
    </button>`;
  }).join('');
  return `<section class="handbook-goals card" aria-label="下一步目標">
    ${head}
    <div class="handbook-goals__list">${cards}</div>
  </section>`;
}

function handbookSection(key, title, collapsedSummary, bodyHtml, available) {
  if (!available) return '';
  const expanded = !!handbookSectionState[key];
  const bodyId = `handbook-section-${key}`;
  return `
  <section class="handbook-section card${expanded ? ' is-expanded' : ''}">
    <button class="handbook-section__header" type="button"
      data-action="handbook-toggle" data-section="${key}"
      aria-expanded="${expanded ? 'true' : 'false'}" aria-controls="${bodyId}">
      <span class="handbook-section__title">${escapeHtml(title)}</span>
      <span class="handbook-section__summary">${collapsedSummary}</span>
      <span class="handbook-section__chevron" aria-hidden="true">▾</span>
    </button>
    <div class="handbook-section__body" id="${bodyId}"${expanded ? '' : ' hidden'}>
      ${bodyHtml}
    </div>
  </section>`;
}

function handbookRow(label, value, chip = '') {
  return `<div class="handbook-row">
    <span class="handbook-row__label">${escapeHtml(label)}</span>
    <span class="handbook-row__value">${value}${chip}</span>
  </div>`;
}

function buildHandbookWeekly(weekly) {
  const parts = [];
  if (weekly.daily.available) parts.push(`每日 ${weekly.daily.completed}/${weekly.daily.total}`);
  if (weekly.weekly.available) parts.push(`每週 ${weekly.weekly.completed}/${weekly.weekly.total}`);
  const summary = parts.length ? escapeHtml(parts.join('・')) : '本週進度';

  const rows = [];
  const claimChip = (n) => n > 0 ? `<span class="handbook-chip handbook-chip--info">可領取 ${n}</span>` : '';
  if (weekly.daily.available) {
    rows.push(handbookRow('每日任務', `${weekly.daily.completed} / ${weekly.daily.total}`, claimChip(weekly.daily.claimable)));
  }
  if (weekly.weekly.available) {
    rows.push(handbookRow('每週任務', `${weekly.weekly.completed} / ${weekly.weekly.total}`, claimChip(weekly.weekly.claimable)));
  }
  if (weekly.habits.available) {
    rows.push(handbookRow('今日習慣', `${weekly.habits.completed} / ${weekly.habits.total}`));
  }
  return handbookSection('weekly', '本週狀態', summary, rows.join(''), weekly.available);
}

function buildHandbookRecords(records) {
  const summary = escapeHtml(`已追蹤 ${records.items.length} 項`);
  const rows = records.items.map((item) => {
    const val = item.note ? `${item.value} ${item.note}` : `${item.value}`;
    return handbookRow(`${item.icon ? item.icon + ' ' : ''}${item.label}`, escapeHtml(String(val)));
  }).join('');
  return handbookSection('records', '長期紀錄', summary, rows, records.available);
}

function buildHandbookCompanions(collection) {
  const c = collection;
  const collSummaryParts = [];
  if (c.collection.available) collSummaryParts.push(`${c.collection.owned}/${c.collection.total}`);
  if (c.maxBond.available) collSummaryParts.push(`最高羈絆 Lv.${c.maxBond.value}`);
  const summary = collSummaryParts.length ? escapeHtml(collSummaryParts.join('・')) : '收藏與夥伴';

  const rows = [];
  if (c.collection.available) rows.push(handbookRow('圖鑑收藏', `${c.collection.owned} / ${c.collection.total}`));
  if (c.milestonesClaimed.available) rows.push(handbookRow('收藏里程碑', `${c.milestonesClaimed.claimed} / ${c.milestonesClaimed.total}`));
  if (c.maxBond.available) rows.push(handbookRow('最高羈絆', `Lv.${c.maxBond.value}`));
  if (c.bondLiberated.available) rows.push(handbookRow('羈絆解放', `${c.bondLiberated.value} 隻`));

  let rarityHtml = '';
  if (Array.isArray(c.rarities) && c.rarities.length) {
    const chips = c.rarities.map((r) =>
      `<span class="handbook-rarity-chip handbook-rarity-chip--${r.rarity.toLowerCase()}">${r.rarity} ${r.owned}/${r.total}</span>`
    ).join('');
    rarityHtml = `<div class="handbook-rarity-chips">${chips}</div>`;
  }

  let petsHtml = '';
  const petCards = [];
  if (c.companion) {
    petCards.push(`
      <div class="handbook-pet">
        ${petImageHtml(c.companion, { size: 'md', loading: 'lazy' })}
        <span class="handbook-pet__role">陪伴夥伴</span>
        <span class="handbook-pet__name">${escapeHtml(c.companion.displayName || c.companion.name || '夥伴')}</span>
        <span class="handbook-pet__bond">羈絆 Lv.${c.companion.bondLevel ?? 1}</span>
      </div>`);
  }
  if (c.bondPet) {
    petCards.push(`
      <div class="handbook-pet">
        ${petImageHtml(c.bondPet, { size: 'md', loading: 'lazy' })}
        <span class="handbook-pet__role">最高羈絆</span>
        <span class="handbook-pet__name">${escapeHtml(c.bondPet.displayName || c.bondPet.name || '夥伴')}</span>
        <span class="handbook-pet__bond">羈絆 Lv.${c.bondPet.bondLevel ?? 1}</span>
      </div>`);
  }
  if (petCards.length) petsHtml = `<div class="handbook-pets">${petCards.join('')}</div>`;

  const body = `${rows.join('')}${rarityHtml}${petsHtml}`;
  return handbookSection('companions', '收藏與夥伴', summary, body, c.available);
}

function buildHandbookExpedition(exp) {
  const summary = exp.averageExploration != null
    ? escapeHtml(`平均探索度 ${exp.averageExploration}%`)
    : '探險與工坊';

  const areaRows = (exp.areas || []).map((a) => {
    const target = a.nextMilestonePercent ?? 100;
    return `<div class="handbook-area">
      <div class="handbook-area__head">
        <span class="handbook-area__name">${escapeHtml(a.icon)} ${escapeHtml(a.name)}</span>
        <span class="handbook-area__pct">${a.progress}%${a.claimableCount > 0 ? ' <span class="handbook-chip handbook-chip--info">可領取</span>' : ''}</span>
      </div>
      ${handbookProgressBar(a.progress)}
    </div>`;
  }).join('');

  const extraRows = [];
  if (exp.closestArea) {
    extraRows.push(handbookRow('最接近里程碑', `${escapeHtml(exp.closestArea.name)}（${exp.closestArea.percent}%）`));
  }
  if (exp.active) {
    const activeText = `${escapeHtml(exp.active.areaName)}・${escapeHtml(exp.active.petName)}`;
    extraRows.push(handbookRow('進行中探險', activeText));
  } else {
    extraRows.push(handbookRow('進行中探險', '目前沒有派遣'));
  }
  if (exp.craftCount.available) extraRows.push(handbookRow('工坊製作', `${exp.craftCount.value} 次`));
  if (exp.materialKinds.available) extraRows.push(handbookRow('材料種類', `${exp.materialKinds.value} 種`));

  const body = `${areaRows}<div class="handbook-area-extra">${extraRows.join('')}</div>`;
  return handbookSection('expedition', '探險與工坊', summary, body, exp.available);
}

function buildHandbookHtml(model) {
  if (!model) return '<p class="handbook-loading">整理你的冒險成果中…</p>';
  return [
    buildHandbookQuickStats(model.quickStats),
    buildHandbookGoals(model.nextGoals),
    buildHandbookWeekly(model.weekly),
    buildHandbookRecords(model.records),
    buildHandbookCompanions(model.collection),
    buildHandbookExpedition(model.expedition),
  ].join('');
}
