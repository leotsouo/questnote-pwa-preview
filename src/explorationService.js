/**
 * 探險地圖探索度系統 — QuestNote V2.7.0
 *
 * 放置探險成長系統：每次成功領取探險獎勵後，對應地區探索度增加，
 * 逐步解鎖地區故事、里程碑、地區徽章與稱號。
 *
 * 重要：本系統為「額外」成長層，不改動任何原本探險倒數 / 基礎收益 / 派遣邏輯。
 * 探索度只在「探險完成並成功領獎」時增加，不在派遣或倒數中增加。
 */
import { dbGet, dbPut, STORES } from './db.js';
import { applyRewardBundle } from './rewardService.js';
import { MATERIAL_LABELS } from './expeditionService.js';

const EXPLORATION_PROGRESS_KEY = 'explorationProgress';

/** 里程碑百分比（所有地區共用） */
export const MILESTONE_PERCENTS = [10, 25, 50, 75, 100];

/** 探索里程碑道具顯示名稱（少量，避免額外載入 craftables） */
const REWARD_ITEM_LABELS = {
  item_warm_snack: '溫暖點心',
  item_astral_honey: '星界蜜糖',
  item_stardust_candy: '星塵糖果',
  item_small_spirit_food: '小份靈食',
};

/** 地區故事文字（達到對應探索度後解鎖顯示） */
export const AREA_STORIES = {
  mist_forest_story_10: '你們在森林深處發現一座被苔蘚覆蓋的古老石碑，上面刻著早已模糊的召喚符文。',
  lava_rift_story_10: '裂谷邊緣傳來低沉的轟鳴聲，像是地底火脈仍在呼吸。',
  machine_ruins_story_10: '古老齒輪緩慢轉動，彷彿這座遺跡從未真正沉睡。',
  astral_rift_story_10: '星光碎片漂浮在半空中，牠們像是在等待某個願望被完成。',
};

/**
 * 地區探索度定義：每個地區的每次增加量與里程碑內容。
 * 目前支援四個核心地區；其餘地區不參與探索度系統（領獎不增加、不顯示）。
 */
export const AREA_EXPLORATION_DEFS = {
  mist_forest: {
    areaId: 'mist_forest',
    name: '迷霧森林',
    increment: 5,
    milestones: [
      {
        percent: 10,
        title: '霧中的石碑',
        description: '你們在森林深處發現一座被苔蘚覆蓋的古老石碑。',
        reward: { stardust: 50 },
        storyId: 'mist_forest_story_10',
      },
      {
        percent: 25,
        title: '林間補給',
        description: '森林的氣息變得熟悉，你更容易找到可用的靈材。',
        reward: { stardust: 80, materials: { forest_leaf: 5 } },
      },
      {
        percent: 50,
        title: '森林巡行徽章',
        description: '你已經熟悉迷霧森林的一半路徑。',
        reward: { stardust: 120, title: '森林巡行者', badgeId: 'badge_mist_forest_50' },
      },
      {
        percent: 75,
        title: '霧林守望者',
        description: '森林中的靈獸開始認可你的腳步。',
        reward: { stardust: 180, items: { item_warm_snack: 1 } },
      },
      {
        percent: 100,
        title: '迷霧森林完全探索',
        description: '你已經完成迷霧森林的主要探索。',
        reward: { stardust: 300, materials: { star_shard: 1 }, title: '霧林完成者', badgeId: 'badge_mist_forest_100' },
      },
    ],
  },
  lava_rift: {
    areaId: 'lava_rift',
    name: '熔岩裂谷',
    increment: 4,
    milestones: [
      {
        percent: 10,
        title: '熔岩邊界',
        description: '你們首次踏入炙熱裂谷，空氣中充滿火元素的震動。',
        reward: { stardust: 60 },
        storyId: 'lava_rift_story_10',
      },
      {
        percent: 25,
        title: '火脈碎片',
        description: '裂谷中的火脈逐漸顯露，能採集到更多熔岩核心。',
        reward: { stardust: 90, materials: { lava_core: 3 } },
      },
      {
        percent: 50,
        title: '火脈行者徽章',
        description: '你已能穩定穿越熔岩裂谷的危險區域。',
        reward: { stardust: 140, title: '火脈行者', badgeId: 'badge_lava_rift_50' },
      },
      {
        percent: 75,
        title: '裂谷深處',
        description: '寵物在火光中發現古老熔岩紋路。',
        reward: { stardust: 200, materials: { lava_core: 5 } },
      },
      {
        percent: 100,
        title: '熔岩裂谷完全探索',
        description: '你完成了熔岩裂谷的主要探索。',
        reward: { stardust: 350, materials: { star_shard: 1 }, title: '裂谷征服者', badgeId: 'badge_lava_rift_100' },
      },
    ],
  },
  machine_ruins: {
    areaId: 'machine_ruins',
    name: '古代機械遺跡',
    increment: 4,
    milestones: [
      {
        percent: 10,
        title: '齒輪門廊',
        description: '遺跡入口的巨大齒輪仍在緩慢轉動。',
        reward: { stardust: 60 },
        storyId: 'machine_ruins_story_10',
      },
      {
        percent: 25,
        title: '遺跡零件庫',
        description: '你們找到了保存尚好的古代零件。',
        reward: { stardust: 90, materials: { machine_part: 3 } },
      },
      {
        percent: 50,
        title: '齒輪考古徽章',
        description: '你已破解部分遺跡結構。',
        reward: { stardust: 140, title: '齒輪考古者', badgeId: 'badge_machine_ruins_50' },
      },
      {
        percent: 75,
        title: '中央控制室',
        description: '你們抵達疑似控制核心的區域。',
        reward: { stardust: 200, materials: { machine_part: 5 } },
      },
      {
        percent: 100,
        title: '古代機械遺跡完全探索',
        description: '你完成了古代機械遺跡的主要探索。',
        reward: { stardust: 350, materials: { star_shard: 1 }, title: '遺跡解讀者', badgeId: 'badge_machine_ruins_100' },
      },
    ],
  },
  astral_rift: {
    areaId: 'astral_rift',
    name: '星界裂縫',
    increment: 3,
    milestones: [
      {
        percent: 10,
        title: '星光邊境',
        description: '星界裂縫中漂浮著無數細小光點，像是未完成的願望。',
        reward: { stardust: 80 },
        storyId: 'astral_rift_story_10',
      },
      {
        percent: 25,
        title: '星屑流域',
        description: '你們開始熟悉星界碎片的流動軌跡。',
        reward: { stardust: 120, materials: { star_shard: 1 } },
      },
      {
        percent: 50,
        title: '星界旅人徽章',
        description: '你已能穩定穿越星界裂縫的一半路徑。',
        reward: { stardust: 180, title: '星界旅人', badgeId: 'badge_astral_rift_50' },
      },
      {
        percent: 75,
        title: '裂縫核心',
        description: '星界深處傳來遙遠的召喚聲。',
        reward: { stardust: 260, materials: { star_shard: 2 } },
      },
      {
        percent: 100,
        title: '星界裂縫完全探索',
        description: '你完成了星界裂縫的主要探索。',
        reward: {
          stardust: 500,
          materials: { star_shard: 3 },
          items: { item_astral_honey: 1 },
          title: '星界完成者',
          badgeId: 'badge_astral_rift_100',
        },
      },
    ],
  },
};

/** 探索度系統支援的地區 id 清單 */
export const EXPLORATION_AREA_IDS = Object.keys(AREA_EXPLORATION_DEFS);

/** 徽章顯示名稱（以里程碑 title 為準，這裡提供備援對照） */
const BADGE_LABELS = {
  badge_mist_forest_50: '森林巡行徽章',
  badge_mist_forest_100: '迷霧森林完成徽章',
  badge_lava_rift_50: '火脈行者徽章',
  badge_lava_rift_100: '熔岩裂谷完成徽章',
  badge_machine_ruins_50: '齒輪考古徽章',
  badge_machine_ruins_100: '古代機械遺跡完成徽章',
  badge_astral_rift_50: '星界旅人徽章',
  badge_astral_rift_100: '星界裂縫完成徽章',
};

function clampProgress(value) {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toSafeInt(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === 'string' || typeof v === 'number');
}

/** 取得某地區依「目前 progress」應已解鎖的故事 id 清單 */
function computeUnlockedStories(areaId, progress, prevStories = []) {
  const def = AREA_EXPLORATION_DEFS[areaId];
  if (!def) return toStringArray(prevStories);
  const set = new Set(toStringArray(prevStories));
  for (const m of def.milestones) {
    if (m.storyId && progress >= m.percent) {
      set.add(m.storyId);
    }
  }
  return [...set];
}

/** 正規化單一地區探索資料 */
function normalizeArea(areaId, raw) {
  const progress = clampProgress(raw?.progress);
  const claimedMilestones = Array.isArray(raw?.claimedMilestones)
    ? raw.claimedMilestones
        .map((p) => Number(p))
        .filter((p) => MILESTONE_PERCENTS.includes(p))
    : [];
  const completedRuns = toSafeInt(raw?.completedRuns);
  const unlockedStories = computeUnlockedStories(areaId, progress, raw?.unlockedStories);
  // progress 未滿 100 不應有 completedAt；滿 100 但缺 completedAt 由更新流程補上
  const completedAt = progress >= 100 ? (raw?.completedAt ?? null) : null;
  return {
    areaId,
    progress,
    completedRuns,
    claimedMilestones: [...new Set(claimedMilestones)].sort((a, b) => a - b),
    unlockedStories,
    completedAt,
    lastExploredAt: raw?.lastExploredAt ?? null,
  };
}

/**
 * 正規化 explorationProgress 資料，補齊舊資料缺少的欄位。
 * clamp progress 到 0～100，claimedMilestones 修正為 array。
 */
export function normalizeExplorationProgress(data) {
  const areasRaw = data?.areas && typeof data.areas === 'object' ? data.areas : {};
  const areas = {};
  for (const areaId of EXPLORATION_AREA_IDS) {
    areas[areaId] = normalizeArea(areaId, areasRaw[areaId]);
  }

  const fullyExploredAreas = EXPLORATION_AREA_IDS.filter(
    (id) => areas[id].progress >= 100
  ).length;

  const stats = data?.stats && typeof data.stats === 'object' ? data.stats : {};

  return {
    key: EXPLORATION_PROGRESS_KEY,
    areas,
    unlockedBadges: toStringArray(data?.unlockedBadges),
    unlockedTitles: toStringArray(data?.unlockedTitles),
    stats: {
      totalExplorationRuns: toSafeInt(stats.totalExplorationRuns),
      totalMilestonesClaimed: toSafeInt(stats.totalMilestonesClaimed),
      fullyExploredAreas,
      lastUpdatedAt: stats.lastUpdatedAt ?? null,
    },
  };
}

/** 建立預設 explorationProgress */
export function createDefaultExplorationProgress() {
  return normalizeExplorationProgress(null);
}

/** 取得 explorationProgress（自動 normalize，必要時寫回） */
export async function getExplorationProgress() {
  const raw = await dbGet(STORES.META, EXPLORATION_PROGRESS_KEY);
  const normalized = normalizeExplorationProgress(raw);
  if (!raw) {
    await dbPut(STORES.META, normalized);
  }
  return normalized;
}

/** 初始化 explorationProgress（首次使用或遷移舊資料） */
export async function initExplorationProgress() {
  const existing = await dbGet(STORES.META, EXPLORATION_PROGRESS_KEY);
  const normalized = normalizeExplorationProgress(existing);
  await dbPut(STORES.META, normalized);
  return normalized;
}

/** 取得單一地區探索資料 */
export async function getAreaExploration(areaId) {
  const ep = await getExplorationProgress();
  return ep.areas[areaId] ?? null;
}

/** 取得某地區每次探險完成的探索度增加量 */
export function getAreaExplorationIncrement(areaId) {
  return AREA_EXPLORATION_DEFS[areaId]?.increment ?? 0;
}

/** 取得某地區里程碑定義 */
export function getExplorationMilestones(areaId) {
  return AREA_EXPLORATION_DEFS[areaId]?.milestones ?? [];
}

/** 取得某地區已解鎖故事（文字） */
export async function getUnlockedAreaStories(areaId) {
  const area = await getAreaExploration(areaId);
  if (!area) return [];
  return area.unlockedStories
    .map((id) => ({ storyId: id, text: AREA_STORIES[id] || '' }))
    .filter((s) => s.text);
}

/** 該地區是否完全探索（100%） */
export async function isAreaFullyExplored(areaId) {
  const area = await getAreaExploration(areaId);
  return !!area && area.progress >= 100;
}

/**
 * 增加某地區探索度（僅在探險成功領獎時呼叫）。
 * @param {string} areaId
 * @param {number} amount 增加量（百分比）
 * @returns {Promise<{ success: boolean, area?: object, increment?: number, newlyReachedMilestones?: object[], newlyUnlockedStories?: object[], justCompleted?: boolean, areaName?: string }>}
 */
export async function updateAreaExplorationProgress(areaId, amount) {
  const def = AREA_EXPLORATION_DEFS[areaId];
  if (!def) {
    return { success: false };
  }
  const inc = typeof amount === 'number' && Number.isFinite(amount) ? amount : def.increment;
  if (inc <= 0) {
    return { success: false };
  }

  const ep = await getExplorationProgress();
  const area = ep.areas[areaId];
  const prevProgress = area.progress;
  const prevStories = new Set(area.unlockedStories);

  area.progress = clampProgress(prevProgress + inc);
  area.completedRuns = toSafeInt(area.completedRuns) + 1;
  area.lastExploredAt = new Date().toISOString();

  let justCompleted = false;
  if (area.progress >= 100 && !area.completedAt) {
    area.completedAt = area.lastExploredAt;
    justCompleted = true;
  }

  // 自動解鎖故事（達到 storyId 里程碑百分比）
  area.unlockedStories = computeUnlockedStories(areaId, area.progress, area.unlockedStories);
  const newlyUnlockedStories = area.unlockedStories
    .filter((id) => !prevStories.has(id))
    .map((id) => ({ storyId: id, text: AREA_STORIES[id] || '' }))
    .filter((s) => s.text);

  // 檢查新達成（可領取）里程碑
  const newlyReachedMilestones = def.milestones.filter(
    (m) => prevProgress < m.percent && area.progress >= m.percent
  );

  ep.stats.totalExplorationRuns = toSafeInt(ep.stats.totalExplorationRuns) + 1;
  ep.stats.fullyExploredAreas = EXPLORATION_AREA_IDS.filter(
    (id) => ep.areas[id].progress >= 100
  ).length;
  ep.stats.lastUpdatedAt = area.lastExploredAt;

  await dbPut(STORES.META, ep);

  return {
    success: true,
    area,
    areaName: def.name,
    increment: inc,
    newlyReachedMilestones,
    newlyUnlockedStories,
    justCompleted,
  };
}

/**
 * 領取地區里程碑獎勵（需使用者手動領取，不自動領取）。
 * @param {string} areaId
 * @param {number} milestonePercent
 * @returns {Promise<{ success: boolean, error?: string, milestone?: object, reward?: object, rewardText?: string }>}
 */
export async function claimExplorationMilestone(areaId, milestonePercent) {
  const def = AREA_EXPLORATION_DEFS[areaId];
  if (!def) return { success: false, error: '地區不存在' };

  const percent = Number(milestonePercent);
  const milestone = def.milestones.find((m) => m.percent === percent);
  if (!milestone) return { success: false, error: '里程碑不存在' };

  const ep = await getExplorationProgress();
  const area = ep.areas[areaId];

  if (area.progress < percent) {
    return { success: false, error: '尚未達到此里程碑' };
  }
  if (area.claimedMilestones.includes(percent)) {
    return { success: false, error: '獎勵已領取' };
  }

  const reward = milestone.reward || {};

  try {
    await applyRewardBundle({
      stardust: reward.stardust,
      materials: reward.materials,
      items: reward.items,
    });
  } catch (err) {
    return { success: false, error: err?.message || '獎勵發放失敗' };
  }

  // 記錄稱號與徽章（不改動既有稱號 / 成就系統，獨立儲存於 explorationProgress）
  if (reward.title && !ep.unlockedTitles.includes(reward.title)) {
    ep.unlockedTitles.push(reward.title);
  }
  if (reward.badgeId && !ep.unlockedBadges.includes(reward.badgeId)) {
    ep.unlockedBadges.push(reward.badgeId);
  }

  area.claimedMilestones = [...new Set([...area.claimedMilestones, percent])].sort((a, b) => a - b);
  ep.stats.totalMilestonesClaimed = toSafeInt(ep.stats.totalMilestonesClaimed) + 1;
  ep.stats.lastUpdatedAt = new Date().toISOString();

  await dbPut(STORES.META, ep);

  return {
    success: true,
    milestone,
    reward,
    rewardText: formatMilestoneReward(reward),
  };
}

/** 格式化里程碑獎勵文字 */
export function formatMilestoneReward(reward) {
  if (!reward) return '無';
  const parts = [];
  if (reward.stardust > 0) parts.push(`星塵 +${reward.stardust}`);
  if (reward.materials) {
    for (const [id, amt] of Object.entries(reward.materials)) {
      if (amt > 0) parts.push(`${MATERIAL_LABELS[id] || id} +${amt}`);
    }
  }
  if (reward.items) {
    for (const [id, amt] of Object.entries(reward.items)) {
      if (amt > 0) parts.push(`${REWARD_ITEM_LABELS[id] || id} +${amt}`);
    }
  }
  if (reward.title) parts.push(`稱號「${reward.title}」`);
  if (reward.badgeId) parts.push(`徽章「${BADGE_LABELS[reward.badgeId] || reward.badgeId}」`);
  return parts.length > 0 ? parts.join('、') : '無';
}

/** 取得獎勵的 chip 顯示資料（供 UI 分類上色） */
export function getRewardChips(reward) {
  if (!reward) return [];
  const chips = [];
  if (reward.stardust > 0) {
    chips.push({ type: 'stardust', label: `星塵 +${reward.stardust}` });
  }
  if (reward.materials) {
    for (const [id, amt] of Object.entries(reward.materials)) {
      if (amt > 0) chips.push({ type: 'material', label: `${MATERIAL_LABELS[id] || id} +${amt}` });
    }
  }
  if (reward.items) {
    for (const [id, amt] of Object.entries(reward.items)) {
      if (amt > 0) chips.push({ type: 'item', label: `${REWARD_ITEM_LABELS[id] || id} +${amt}` });
    }
  }
  if (reward.title) {
    chips.push({ type: 'title', label: `稱號「${reward.title}」` });
  }
  if (reward.badgeId) {
    chips.push({ type: 'title', label: `徽章「${BADGE_LABELS[reward.badgeId] || reward.badgeId}」` });
  }
  return chips;
}

/**
 * 取得供 UI 使用的探索度摘要。
 */
export async function getExplorationSummary() {
  const ep = await getExplorationProgress();

  const areas = EXPLORATION_AREA_IDS.map((areaId) => {
    const def = AREA_EXPLORATION_DEFS[areaId];
    const area = ep.areas[areaId];
    const milestones = def.milestones.map((m) => {
      let status = 'locked';
      if (area.claimedMilestones.includes(m.percent)) status = 'claimed';
      else if (area.progress >= m.percent) status = 'claimable';
      return {
        percent: m.percent,
        title: m.title,
        description: m.description,
        reward: m.reward,
        rewardChips: getRewardChips(m.reward),
        storyId: m.storyId || null,
        status,
      };
    });

    const nextMilestone = milestones.find((m) => area.progress < m.percent) || null;
    const claimableCount = milestones.filter((m) => m.status === 'claimable').length;
    const stories = area.unlockedStories
      .map((id) => ({ storyId: id, text: AREA_STORIES[id] || '' }))
      .filter((s) => s.text);
    // 尚未解鎖的第一個故事百分比（供 locked 提示）
    const firstStoryMilestone = def.milestones.find((m) => m.storyId);
    const storyLockedPercent = firstStoryMilestone ? firstStoryMilestone.percent : 10;

    return {
      areaId,
      name: def.name,
      increment: def.increment,
      progress: area.progress,
      completedRuns: area.completedRuns,
      completedAt: area.completedAt,
      lastExploredAt: area.lastExploredAt,
      fullyExplored: area.progress >= 100,
      milestones,
      nextMilestone,
      claimableCount,
      stories,
      storyLockedPercent,
      hasStory: stories.length > 0,
    };
  });

  const totalClaimable = areas.reduce((sum, a) => sum + a.claimableCount, 0);

  return {
    areas,
    unlockedBadges: [...ep.unlockedBadges],
    unlockedTitles: [...ep.unlockedTitles],
    stats: { ...ep.stats },
    totalClaimable,
  };
}

/** 匯出 explorationProgress（備份用） */
export async function exportExplorationProgress() {
  return getExplorationProgress();
}
