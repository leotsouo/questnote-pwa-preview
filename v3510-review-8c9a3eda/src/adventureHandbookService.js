/**
 * 冒險手冊資料服務 — V2.9.0
 *
 * 本服務只負責「整合現有服務的可信資料」並產出手冊摘要模型，
 * 不操作 DOM、不新增任何持久化資料、不建立虛構的綜合分數。
 *
 * 資料可信原則：
 *   - 只顯示程式碼與 IndexedDB 中真實存在、可靠計算的資料。
 *   - 缺少歷史累積資料的項目一律標記 available=false，由 UI 忽略，不顯示假 0 / NaN。
 *   - 長期紀錄只在有實際累積（value > 0）時渲染，避免整頁的 0。
 *
 * 設計：
 *   - buildAdventureHandbookModel(context)：純函式，方便測試與離線計算。
 *   - getAdventureHandbookContext(state)：以現有公開 service API 補齊時效性資料。
 *   - getAdventureHandbookSummary(state)：非同步整合入口，供 UI 呼叫。
 */

import { getQuestSummary } from './questService.js';
import { getExplorationSummary } from './explorationService.js';
import { getAllExpeditions } from './expeditionService.js';
import { getBondProgress } from './collectionService.js';

/** 四個核心地區的圖示（不含 polar_shore / harvest_fields） */
export const HANDBOOK_AREA_ICONS = {
  mist_forest: '🌲',
  lava_rift: '🌋',
  machine_ruins: '⚙️',
  astral_rift: '🌌',
};

const CATEGORY_ICON = {
  collection: '📚',
  exploration: '🗺️',
  quest: '📜',
  bond: '💞',
  achievement: '🏅',
};

const MAX_QUICK_STATS = 4;
const MAX_NEXT_GOALS = 3;
const MAX_GOALS_PER_CATEGORY = 2;

/** 建立一致的統計格式 */
function stat(available, payload = {}) {
  if (!available) return { available: false };
  return { available: true, ...payload };
}

function toInt(value) {
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

function safeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

/* ------------------------------------------------------------------ *
 * 精簡成長摘要（常駐，最多 4 項）
 * ------------------------------------------------------------------ */

/** 取得已擁有寵物中的最高羈絆等級（0 表示尚無寵物） */
export function getHighestBondLevel(enrichedCollection = []) {
  let max = 0;
  for (const pet of enrichedCollection) {
    if (pet?.owned && Number.isFinite(pet.bondLevel)) {
      max = Math.max(max, pet.bondLevel);
    }
  }
  return max;
}

/** 取得已擁有寵物中的最高星級（0 表示尚無寵物） */
export function getHighestStar(enrichedCollection = []) {
  let max = 0;
  for (const pet of enrichedCollection) {
    if (pet?.owned && Number.isFinite(pet.stars)) {
      max = Math.max(max, pet.stars);
    }
  }
  return max;
}

/** 找出羈絆最高的已擁有寵物 */
export function getHighestBondPet(enrichedCollection = []) {
  let best = null;
  for (const pet of enrichedCollection) {
    if (!pet?.owned) continue;
    if (!best || (pet.bondLevel ?? 0) > (best.bondLevel ?? 0)) {
      best = pet;
    }
  }
  return best;
}

/**
 * 平均探索度：四個核心地區進度的算術平均。
 * 明確命名為「平均探索度」，不代表世界或全系統完成度。
 */
export function getAverageExploration(explorationSummary) {
  const areas = explorationSummary?.areas;
  if (!Array.isArray(areas) || areas.length === 0) return null;
  const sum = areas.reduce((acc, a) => acc + safeNumber(a.progress, 0), 0);
  return Math.round(sum / areas.length);
}

function buildQuickStats(ctx) {
  const stats = [];

  // 1. 本週挑戰（每週任務完成數）
  const weekly = ctx.questSummary?.weekly;
  if (weekly && Number.isFinite(weekly.total) && weekly.total > 0) {
    stats.push({
      available: true,
      key: 'weekly-quests',
      icon: '📜',
      label: '本週挑戰',
      value: `${toInt(weekly.completedCount)} / ${toInt(weekly.total)}`,
      actionView: 'tasks',
    });
  }

  // 2. 圖鑑收藏率
  const collection = ctx.collectionProgress;
  if (collection && Number.isFinite(collection.total) && collection.total > 0) {
    stats.push({
      available: true,
      key: 'collection',
      icon: '📖',
      label: '圖鑑收藏',
      value: `${toInt(collection.owned)} / ${toInt(collection.total)}`,
      actionView: 'collection',
    });
  }

  // 3. 最高羈絆（需有已擁有寵物）
  const maxBond = getHighestBondLevel(ctx.enrichedCollection);
  if (maxBond >= 1) {
    stats.push({
      available: true,
      key: 'max-bond',
      icon: '💞',
      label: '最高羈絆',
      value: `Lv.${maxBond}`,
      actionView: 'collection',
    });
  }

  // 4. 平均探索度（四個核心地區）
  const avg = getAverageExploration(ctx.explorationSummary);
  if (avg != null) {
    stats.push({
      available: true,
      key: 'avg-exploration',
      icon: '🗺️',
      label: '平均探索度',
      value: `${avg}%`,
      actionView: 'expedition',
    });
  }

  return stats.slice(0, MAX_QUICK_STATS);
}

/* ------------------------------------------------------------------ *
 * 下一步目標（常駐，最多 3 項，可解釋規則）
 * ------------------------------------------------------------------ */

/** 依規則計算目標優先度（可解釋，不使用複雜權重模型） */
export function scoreGoal(goal) {
  let priority = 0;
  const progress = safeNumber(goal.progress, 0);
  if (goal.status === 'claimable') priority += 1000;
  if (progress >= 0.9) priority += 200;
  else if (progress >= 0.75) priority += 100;
  // 剩餘數量越少越優先（上限保護，避免大目標拿到負分過重）
  const remaining = Number.isFinite(goal.remaining) ? goal.remaining : 99;
  priority += Math.max(0, 30 - remaining);
  return priority;
}

function collectGoalCandidates(ctx) {
  const candidates = [];

  // --- 收藏里程碑 ---
  const ms = ctx.collectionMilestoneSummary;
  if (ms?.items) {
    for (const item of ms.items) {
      if (item.status === 'claimable') {
        candidates.push({
          id: `collection-claim-${item.id}`,
          category: 'collection',
          icon: item.badge?.icon || CATEGORY_ICON.collection,
          title: item.title,
          current: item.progress,
          target: item.target,
          progress: 1,
          remaining: 0,
          status: 'claimable',
          hint: '里程碑已達成，可領取獎勵',
          actionView: 'collection',
        });
      }
    }
    const next = ms.nextMilestone;
    if (next && next.status !== 'claimed') {
      const remaining = Math.max(0, next.target - next.rawProgress);
      candidates.push({
        id: `collection-next-${next.id}`,
        category: 'collection',
        icon: next.badge?.icon || CATEGORY_ICON.collection,
        title: next.title,
        current: next.progress,
        target: next.target,
        progress: next.target > 0 ? next.progress / next.target : 0,
        remaining,
        status: 'in_progress',
        hint: remaining > 0 ? `再收集 ${remaining} 隻不同寵物` : '即將達成',
        actionView: 'collection',
      });
    }
  }

  // --- 探索度里程碑（四個核心地區）---
  const areas = ctx.explorationSummary?.areas || [];
  for (const area of areas) {
    if (area.claimableCount > 0) {
      candidates.push({
        id: `exploration-claim-${area.areaId}`,
        category: 'exploration',
        icon: HANDBOOK_AREA_ICONS[area.areaId] || CATEGORY_ICON.exploration,
        title: area.name,
        current: area.progress,
        target: 100,
        progress: 1,
        remaining: 0,
        status: 'claimable',
        hint: '可領取探索里程碑',
        actionView: 'expedition',
        unit: '%',
      });
    } else if (area.nextMilestone) {
      const diff = Math.max(0, area.nextMilestone.percent - area.progress);
      const increment = safeNumber(area.increment, 0);
      const runsNeeded = increment > 0 ? Math.ceil(diff / increment) : null;
      candidates.push({
        id: `exploration-next-${area.areaId}`,
        category: 'exploration',
        icon: HANDBOOK_AREA_ICONS[area.areaId] || CATEGORY_ICON.exploration,
        title: area.name,
        current: area.progress,
        target: area.nextMilestone.percent,
        progress: area.nextMilestone.percent > 0 ? area.progress / area.nextMilestone.percent : 0,
        remaining: runsNeeded ?? diff,
        status: 'in_progress',
        hint: runsNeeded != null
          ? `再完成 ${runsNeeded} 次探險即可接近里程碑`
          : `距離 ${area.nextMilestone.percent}% 里程碑`,
        actionView: 'expedition',
        unit: '%',
      });
    }
  }

  // --- 每日 / 每週任務 ---
  const qs = ctx.questSummary;
  if (qs) {
    const questItems = [
      ...(qs.daily?.items || []).map((q) => ({ ...q, scope: 'daily' })),
      ...(qs.weekly?.items || []).map((q) => ({ ...q, scope: 'weekly' })),
    ];
    for (const q of questItems) {
      if (q.claimed) continue;
      const target = safeNumber(q.target, 0);
      const current = safeNumber(q.current, 0);
      if (q.status === 'claimable' || q.completed) {
        candidates.push({
          id: `quest-claim-${q.scope}-${q.id}`,
          category: 'quest',
          icon: CATEGORY_ICON.quest,
          title: q.title,
          current,
          target,
          progress: 1,
          remaining: 0,
          status: 'claimable',
          hint: '任務已完成，可領取獎勵',
          actionView: 'tasks',
        });
      } else {
        const remaining = Math.max(0, target - current);
        candidates.push({
          id: `quest-next-${q.scope}-${q.id}`,
          category: 'quest',
          icon: CATEGORY_ICON.quest,
          title: q.title,
          current,
          target,
          progress: target > 0 ? current / target : 0,
          remaining,
          status: 'in_progress',
          hint: q.scope === 'weekly' ? '本週任務進行中' : '今日任務進行中',
          actionView: 'tasks',
        });
      }
    }
  }

  // --- 陪伴寵物羈絆 ---
  const companion = ctx.companion;
  if (companion && Number.isFinite(companion.bondLevel) && companion.bondLevel < 5) {
    const bp = getBondProgress(safeNumber(companion.bondExp, 0), companion.bondLevel);
    const remaining = Math.max(0, safeNumber(bp.max, 0) - safeNumber(bp.current, 0));
    candidates.push({
      id: 'bond-companion',
      category: 'bond',
      icon: CATEGORY_ICON.bond,
      title: `${companion.displayName || companion.name || '陪伴寵物'}`,
      current: bp.current,
      target: bp.max,
      progress: safeNumber(bp.percent, 0) / 100,
      remaining,
      status: 'in_progress',
      hint: `陪伴或贈禮提升至羈絆 Lv.${companion.bondLevel + 1}`,
      actionView: 'tasks',
    });
  }

  // --- 成就（僅可領取，確保使用者能直接採取行動）---
  const ach = ctx.achievementSummary;
  if (ach?.items) {
    for (const item of ach.items) {
      if (item.status === 'claimable') {
        candidates.push({
          id: `achievement-claim-${item.achievement?.id}`,
          category: 'achievement',
          icon: CATEGORY_ICON.achievement,
          title: item.achievement?.name || '成就',
          current: item.progress,
          target: item.target,
          progress: 1,
          remaining: 0,
          status: 'claimable',
          hint: '成就已達成，可領取獎勵',
          actionView: 'achievements',
        });
      }
    }
  }

  return candidates;
}

/**
 * 產生下一步目標：
 *   排序：可領取 > 高完成率 > 剩餘少
 *   去重：最多 3 項，且同一 category 最多 2 項，並盡量涵蓋不同系統。
 */
export function buildNextGoals(ctx) {
  const candidates = collectGoalCandidates(ctx).map((g) => ({
    ...g,
    priority: scoreGoal(g),
  }));

  candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.remaining !== b.remaining) return a.remaining - b.remaining;
    return safeNumber(b.progress) - safeNumber(a.progress);
  });

  const selected = [];
  const perCategory = {};
  for (const goal of candidates) {
    if (selected.length >= MAX_NEXT_GOALS) break;
    const count = perCategory[goal.category] || 0;
    if (count >= MAX_GOALS_PER_CATEGORY) continue;
    selected.push(goal);
    perCategory[goal.category] = count + 1;
  }

  return selected;
}

/* ------------------------------------------------------------------ *
 * 本週狀態（可收合）
 * ------------------------------------------------------------------ */

export function buildWeeklySummary(ctx) {
  const qs = ctx.questSummary;
  const daily = qs?.daily
    ? stat(true, {
        completed: toInt(qs.daily.completedCount),
        total: toInt(qs.daily.total),
        claimable: toInt(qs.daily.claimableCount),
      })
    : stat(false);
  const weekly = qs?.weekly
    ? stat(true, {
        completed: toInt(qs.weekly.completedCount),
        total: toInt(qs.weekly.total),
        claimable: toInt(qs.weekly.claimableCount),
      })
    : stat(false);

  // 習慣：只有 habit service 能可靠計算「今日」時才顯示
  const hs = ctx.habitStats;
  const habits = hs && hs.hasHabits
    ? stat(true, {
        completed: toInt(hs.todayCompleted),
        total: toInt(hs.todayTotal),
      })
    : stat(false);

  const available = daily.available || weekly.available || habits.available;
  return { available, daily, weekly, habits };
}

/* ------------------------------------------------------------------ *
 * 長期紀錄（可收合）— 僅顯示真實歷史累積，且 value > 0 才渲染
 * ------------------------------------------------------------------ */

export function buildLongTermRecords(ctx) {
  const items = [];

  const push = (available, key, icon, label, value, note) => {
    if (!available) return;
    if (!Number.isFinite(value) || value <= 0) return;
    items.push({ available: true, key, icon, label, value, note });
  };

  // 抽卡：gachaStats.totalPulls（歷史累積）
  const gacha = ctx.gachaStats;
  push(!!gacha, 'total-pulls', '✨', '累計召喚', toInt(gacha?.totalPulls), '次');

  // 工坊：workshopStats.craftCount / giftCount（歷史累積）
  const ws = ctx.workshopStats;
  push(!!ws, 'craft-count', '🔨', '工坊製作', toInt(ws?.craftCount), '次');
  push(!!ws, 'gift-count', '🎁', '贈禮次數', toInt(ws?.giftCount), '次');

  // 簽到：totalCheckIns / bestStreak（歷史累積）
  const daily = ctx.dailyCheckIn;
  push(!!daily, 'total-checkins', '📅', '累計簽到', toInt(daily?.totalCheckIns), '天');
  push(!!daily, 'best-streak', '🔥', '最長連續簽到', toInt(daily?.bestStreak), '天');

  // 探險：已領獎探險數（由 expeditions store 歷史列可靠推算）
  if (Number.isFinite(ctx.expeditionClaimedCount)) {
    push(true, 'expedition-claimed', '🗺️', '完成探險', toInt(ctx.expeditionClaimedCount), '次');
  }

  // 探索：totalExplorationRuns（歷史累積）
  const exp = ctx.explorationSummary;
  push(!!exp?.stats, 'exploration-runs', '🧭', '探索次數', toInt(exp?.stats?.totalExplorationRuns), '次');

  // 成就 / 稱號：已解鎖為持久狀態
  const ach = ctx.achievementSummary;
  if (ach && Number.isFinite(ach.unlocked) && ach.unlocked > 0) {
    items.push({
      available: true,
      key: 'achievements',
      icon: '🏅',
      label: '已解鎖成就',
      value: `${toInt(ach.unlocked)} / ${toInt(ach.total)}`,
    });
  }
  const unlockedTitles = ach?.state?.unlockedTitleIds?.length ?? 0;
  const totalTitles = ach?.titles?.length ?? 0;
  if (unlockedTitles > 0) {
    items.push({
      available: true,
      key: 'titles',
      icon: '🏆',
      label: '已解鎖稱號',
      value: `${toInt(unlockedTitles)} / ${toInt(totalTitles)}`,
    });
  }

  return { available: items.length > 0, items };
}

/* ------------------------------------------------------------------ *
 * 收藏與夥伴（可收合）
 * ------------------------------------------------------------------ */

export function buildCollectionSummary(ctx) {
  const progress = ctx.collectionProgress;
  const ms = ctx.collectionMilestoneSummary;
  const context = ms?.context;

  const rarityOrder = ['N', 'R', 'SR', 'SSR', 'UR'];
  const rarities = context
    ? rarityOrder
        .filter((r) => (context.rarityTotals?.[r] ?? 0) > 0)
        .map((r) => ({
          rarity: r,
          owned: toInt(context.rarityOwned?.[r] ?? 0),
          total: toInt(context.rarityTotals?.[r] ?? 0),
        }))
    : [];

  const maxBond = getHighestBondLevel(ctx.enrichedCollection);
  const maxStar = getHighestStar(ctx.enrichedCollection);
  const bondLiberated = context ? toInt(context.bondLiberatedCount) : null;

  const companion = ctx.companion || null;
  const bondPet = getHighestBondPet(ctx.enrichedCollection);
  // 同一隻寵物只顯示一次
  const showBondPetSeparately = bondPet
    && (!companion || bondPet.id !== companion.id)
    && (bondPet.bondLevel ?? 0) >= 1;

  const available = !!progress && Number.isFinite(progress.total) && progress.total > 0;

  return {
    available,
    collection: progress
      ? stat(true, { owned: toInt(progress.owned), total: toInt(progress.total) })
      : stat(false),
    rarities,
    milestonesClaimed: ms
      ? stat(true, { claimed: toInt(ms.claimedCount), total: toInt(ms.total) })
      : stat(false),
    maxStar: maxStar >= 1 ? stat(true, { value: maxStar }) : stat(false),
    maxBond: maxBond >= 1 ? stat(true, { value: maxBond }) : stat(false),
    bondLiberated: bondLiberated != null ? stat(true, { value: bondLiberated }) : stat(false),
    companion,
    bondPet: showBondPetSeparately ? bondPet : null,
  };
}

/* ------------------------------------------------------------------ *
 * 探險與工坊（可收合）
 * ------------------------------------------------------------------ */

export function buildExpeditionSummary(ctx) {
  const areas = (ctx.explorationSummary?.areas || []).map((a) => ({
    areaId: a.areaId,
    name: a.name,
    icon: HANDBOOK_AREA_ICONS[a.areaId] || '🗺️',
    progress: toInt(a.progress),
    nextMilestonePercent: a.nextMilestone?.percent ?? null,
    fullyExplored: !!a.fullyExplored,
    claimableCount: toInt(a.claimableCount),
  }));

  // 最接近下一個里程碑的地區（尚有未完成里程碑者）
  let closestArea = null;
  for (const a of ctx.explorationSummary?.areas || []) {
    if (!a.nextMilestone) continue;
    const diff = a.nextMilestone.percent - a.progress;
    if (!closestArea || diff < closestArea.diff) {
      closestArea = { areaId: a.areaId, name: a.name, percent: a.nextMilestone.percent, diff };
    }
  }

  const avg = getAverageExploration(ctx.explorationSummary);

  // 目前進行中探險
  const active = ctx.activeExpedition;
  let activeInfo = null;
  if (active) {
    const area = (ctx.expeditionAreas || []).find((ar) => ar.id === active.areaId);
    const pet = (ctx.allPets || []).find((p) => p.id === active.petId);
    activeInfo = {
      areaName: area?.name || active.areaId || '探險',
      petName: pet?.name || '夥伴',
      claimed: !!active.claimed,
      endsAt: active.endsAt || null,
    };
  }

  // 工坊：只顯示可靠的歷史累積 / 當前庫存種類
  const ws = ctx.workshopStats;
  const craftCount = ws && toInt(ws.craftCount) > 0
    ? stat(true, { value: toInt(ws.craftCount) })
    : stat(false);

  const materials = ctx.wallet?.materials || {};
  const materialKinds = Object.values(materials).filter((n) => Number.isFinite(n) && n > 0).length;

  const available = areas.length > 0 || !!activeInfo || craftCount.available;

  return {
    available,
    areas,
    closestArea,
    averageExploration: avg,
    active: activeInfo,
    craftCount,
    materialKinds: materialKinds > 0 ? stat(true, { value: materialKinds }) : stat(false),
  };
}

/* ------------------------------------------------------------------ *
 * 主模型組裝（純函式）
 * ------------------------------------------------------------------ */

export function buildAdventureHandbookModel(context = {}) {
  const ctx = context || {};
  return {
    quickStats: buildQuickStats(ctx),
    nextGoals: buildNextGoals(ctx),
    weekly: buildWeeklySummary(ctx),
    records: buildLongTermRecords(ctx),
    collection: buildCollectionSummary(ctx),
    expedition: buildExpeditionSummary(ctx),
  };
}

/* ------------------------------------------------------------------ *
 * 非同步整合入口
 * ------------------------------------------------------------------ */

/**
 * 以現有公開 service API 補齊時效性資料（跨日 / 跨週 rollover 由 quest service 處理）。
 * 其餘重量級資料（allPets、enrichedCollection、collectionMilestoneSummary 等）直接沿用 app state 快照。
 * @param {object} state app 全域狀態
 */
export async function getAdventureHandbookContext(state = {}) {
  const [questSummary, explorationSummary, expeditions] = await Promise.all([
    getQuestSummary().catch(() => state.questSummary ?? null),
    getExplorationSummary().catch(() => state.explorationSummary ?? null),
    getAllExpeditions().catch(() => []),
  ]);

  const expeditionClaimedCount = Array.isArray(expeditions)
    ? expeditions.filter((e) => e && e.claimed).length
    : null;

  return {
    allPets: state.allPets || [],
    wallet: state.wallet || null,
    collectionProgress: state.collectionProgress || null,
    collectionMilestoneSummary: state.collectionMilestoneSummary || null,
    enrichedCollection: state.enrichedCollection || [],
    companion: state.companion || null,
    achievementSummary: state.achievementSummary || null,
    gachaStats: state.gachaStats || null,
    workshopStats: state.workshopStats || null,
    dailyCheckIn: state.dailyCheckIn || null,
    activeExpedition: state.activeExpedition || null,
    expeditionAreas: state.expeditionAreas || [],
    habitStats: state.habitStats || null,
    questSummary,
    explorationSummary,
    expeditionClaimedCount,
  };
}

/**
 * 取得完整冒險手冊摘要模型（供 UI 呼叫）。
 * @param {object} state app 全域狀態
 */
export async function getAdventureHandbookSummary(state = {}) {
  const context = await getAdventureHandbookContext(state);
  return buildAdventureHandbookModel(context);
}
