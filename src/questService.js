/**
 * 每日任務 / 每週任務系統 — QuestNote V2.5.0
 *
 * 這是遊戲化挑戰系統，會依使用者在 App 內的行為（完成任務、習慣、撫摸寵物、
 * 派遣探險、簽到、工坊互動、贈禮）累積進度，並提供額外獎勵。
 *
 * 重要：本系統為「額外」獎勵層，不改動任何原本任務／習慣／探險／工坊／簽到的收益。
 */
import { dbGet, dbPut, STORES } from './db.js';
import { applyRewardBundle } from './rewardService.js';
import { getTodayDateString } from './taskFilterService.js';

const QUEST_PROGRESS_KEY = 'questProgress';

/**
 * 取得本機日期字串（YYYY-MM-DD）。
 * 使用本機時區，避免 UTC 造成台灣凌晨跨日錯亂。
 */
export function getTodayKey(date = new Date()) {
  return getTodayDateString(date);
}

/**
 * 取得本機週次字串（YYYY-WXX），週一為每週開始（ISO 8601 週）。
 * 使用本機時區。
 */
export function getWeekKey(date = new Date()) {
  // 以本機日期建立午夜時間，避免時區偏移
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // ISO 週：週一=1 ... 週日=7
  const day = d.getDay() === 0 ? 7 : d.getDay();
  // 移到當週的週四（ISO 週以包含週四的年為準）
  d.setDate(d.getDate() + (4 - day));
  const isoYear = d.getFullYear();
  const yearStart = new Date(isoYear, 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${isoYear}-W${String(weekNo).padStart(2, '0')}`;
}

/** 每日任務定義（初始 6 個） */
export const DAILY_QUEST_DEFS = [
  {
    id: 'daily_complete_tasks_3',
    type: 'complete_tasks',
    title: '完成 3 個任務',
    description: '今天完成 3 個任務。',
    target: 3,
    reward: { stardust: 50, adventureEnergy: 1 },
  },
  {
    id: 'daily_complete_habit_1',
    type: 'complete_habits',
    title: '完成 1 個習慣',
    description: '今天完成 1 個習慣打卡。',
    target: 1,
    reward: { stardust: 30 },
  },
  {
    id: 'daily_pet_companion_1',
    type: 'pet_companion',
    title: '關心陪伴寵物',
    description: '今天撫摸陪伴寵物 1 次。',
    target: 1,
    reward: { stardust: 20, items: { item_small_spirit_food: 1 } },
  },
  {
    id: 'daily_checkin_1',
    type: 'daily_checkin',
    title: '領取每日祝福',
    description: '今天完成每日簽到。',
    target: 1,
    reward: { stardust: 20 },
  },
  {
    id: 'daily_start_expedition_1',
    type: 'start_expedition',
    title: '派遣 1 次探險',
    description: '今天派遣寵物進行 1 次探險。',
    target: 1,
    reward: { adventureEnergy: 1, materials: { forest_leaf: 2 } },
  },
  {
    id: 'daily_craft_or_gift_1',
    type: 'craft_or_gift',
    title: '完成 1 次工坊互動',
    description: '今天製作道具或贈送寵物禮物 1 次。',
    target: 1,
    reward: { stardust: 30, materials: { forest_leaf: 1 } },
  },
];

/** 每週任務定義（初始 5 個） */
export const WEEKLY_QUEST_DEFS = [
  {
    id: 'weekly_complete_tasks_20',
    type: 'complete_tasks',
    title: '本週完成 20 個任務',
    description: '本週累積完成 20 個任務。',
    target: 20,
    reward: { stardust: 300, adventureEnergy: 5 },
  },
  {
    id: 'weekly_complete_habits_10',
    type: 'complete_habits',
    title: '本週完成 10 次習慣',
    description: '本週累積完成 10 次習慣打卡。',
    target: 10,
    reward: { stardust: 180, items: { item_warm_snack: 1 } },
  },
  {
    id: 'weekly_checkin_5',
    type: 'daily_checkin',
    title: '本週簽到 5 天',
    description: '本週完成 5 天每日簽到。',
    target: 5,
    reward: { stardust: 250, materials: { star_shard: 1 } },
  },
  {
    id: 'weekly_expedition_5',
    type: 'complete_expedition',
    title: '本週完成 5 次探險',
    description: '本週完成 5 次寵物探險。',
    target: 5,
    reward: { stardust: 220, materials: { lava_core: 2, machine_part: 2 } },
  },
  {
    id: 'weekly_gift_5',
    type: 'gift_pet',
    title: '本週贈送 5 次禮物',
    description: '本週贈送寵物親密度道具 5 次。',
    target: 5,
    reward: { stardust: 200, items: { item_stardust_candy: 1 } },
  },
];

/**
 * 行為事件 → 對應要加進度的任務清單。
 * scope 為 'daily' | 'weekly'，questId 對應定義 id。
 */
const EVENT_QUEST_MAP = {
  complete_task: [['daily', 'daily_complete_tasks_3'], ['weekly', 'weekly_complete_tasks_20']],
  complete_habit: [['daily', 'daily_complete_habit_1'], ['weekly', 'weekly_complete_habits_10']],
  pet_companion: [['daily', 'daily_pet_companion_1']],
  daily_checkin: [['daily', 'daily_checkin_1'], ['weekly', 'weekly_checkin_5']],
  start_expedition: [['daily', 'daily_start_expedition_1']],
  complete_expedition: [['weekly', 'weekly_expedition_5']],
  craft: [['daily', 'daily_craft_or_gift_1']],
  gift_pet: [['daily', 'daily_craft_or_gift_1'], ['weekly', 'weekly_gift_5']],
};

function getDefById(scope, questId) {
  const defs = scope === 'weekly' ? WEEKLY_QUEST_DEFS : DAILY_QUEST_DEFS;
  return defs.find((d) => d.id === questId) || null;
}

function toSafeInt(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

/**
 * 依定義建立任務清單，並保留既有進度（current / completed / claimed）。
 * 這也是 migration：未來新增定義時會自動補上預設值。
 */
function mergeQuests(defs, storedQuests) {
  const quests = {};
  for (const def of defs) {
    const prev = storedQuests?.[def.id] || null;
    const target = def.target;
    let current = prev && typeof prev.current === 'number' ? Math.floor(prev.current) : 0;
    current = Math.max(0, Math.min(target, current));
    const completed = prev?.completed === true || current >= target;
    const claimed = prev?.claimed === true;
    quests[def.id] = {
      id: def.id,
      type: def.type,
      title: def.title,
      description: def.description,
      current,
      target,
      completed,
      claimed,
    };
  }
  return quests;
}

/**
 * 正規化 questProgress 資料，補齊舊資料缺少的欄位。
 * 不做跨日 / 跨週重置（由 rolloverQuestProgress 處理）。
 */
export function normalizeQuestProgress(data) {
  const daily = data?.daily || null;
  const weekly = data?.weekly || null;
  const stats = data?.stats || null;
  return {
    key: QUEST_PROGRESS_KEY,
    daily: {
      dateKey: typeof daily?.dateKey === 'string' ? daily.dateKey : null,
      quests: mergeQuests(DAILY_QUEST_DEFS, daily?.quests),
    },
    weekly: {
      weekKey: typeof weekly?.weekKey === 'string' ? weekly.weekKey : null,
      quests: mergeQuests(WEEKLY_QUEST_DEFS, weekly?.quests),
    },
    stats: {
      totalDailyQuestsClaimed: toSafeInt(stats?.totalDailyQuestsClaimed),
      totalWeeklyQuestsClaimed: toSafeInt(stats?.totalWeeklyQuestsClaimed),
      lastUpdatedAt: stats?.lastUpdatedAt ?? null,
    },
  };
}

/**
 * 跨日 / 跨週重置。過期時以全新任務清單覆蓋（未領獎勵不保留，符合每日/每週重置設計）。
 * @returns {{ questProgress: object, changed: boolean }}
 */
export function rolloverQuestProgress(qp, todayKey = getTodayKey(), weekKey = getWeekKey()) {
  let changed = false;
  const next = qp;

  if (next.daily.dateKey !== todayKey) {
    next.daily = { dateKey: todayKey, quests: mergeQuests(DAILY_QUEST_DEFS, null) };
    changed = true;
  }
  if (next.weekly.weekKey !== weekKey) {
    next.weekly = { weekKey, quests: mergeQuests(WEEKLY_QUEST_DEFS, null) };
    changed = true;
  }
  return { questProgress: next, changed };
}

/** 建立預設 questProgress（今天 / 本週） */
export function createDefaultQuestProgress() {
  const todayKey = getTodayKey();
  const weekKey = getWeekKey();
  return {
    key: QUEST_PROGRESS_KEY,
    daily: { dateKey: todayKey, quests: mergeQuests(DAILY_QUEST_DEFS, null) },
    weekly: { weekKey, quests: mergeQuests(WEEKLY_QUEST_DEFS, null) },
    stats: {
      totalDailyQuestsClaimed: 0,
      totalWeeklyQuestsClaimed: 0,
      lastUpdatedAt: null,
    },
  };
}

/**
 * 取得 questProgress（會自動 normalize + rollover，並在需要時寫回）。
 */
export async function getQuestProgress() {
  const raw = await dbGet(STORES.META, QUEST_PROGRESS_KEY);
  const normalized = normalizeQuestProgress(raw);
  const { questProgress, changed } = rolloverQuestProgress(normalized);
  if (changed || !raw) {
    await dbPut(STORES.META, questProgress);
  }
  return questProgress;
}

/** 初始化 questProgress（首次使用或遷移舊資料） */
export async function initQuestProgress() {
  const existing = await dbGet(STORES.META, QUEST_PROGRESS_KEY);
  const normalized = existing ? normalizeQuestProgress(existing) : createDefaultQuestProgress();
  const { questProgress } = rolloverQuestProgress(normalized);
  await dbPut(STORES.META, questProgress);
  return questProgress;
}

/**
 * 依行為事件更新任務進度。
 * @param {string} eventType 例如 'complete_task'
 * @param {number} [amount=1]
 * @returns {{ questProgress: object, newlyCompleted: {scope:string, quest:object}[] }}
 */
export async function updateQuestProgress(eventType, amount = 1) {
  const mappings = EVENT_QUEST_MAP[eventType];
  const qp = await getQuestProgress();
  if (!mappings || amount <= 0) {
    return { questProgress: qp, newlyCompleted: [] };
  }

  const newlyCompleted = [];
  for (const [scope, questId] of mappings) {
    const bucket = scope === 'weekly' ? qp.weekly : qp.daily;
    const quest = bucket?.quests?.[questId];
    if (!quest) continue;
    const wasCompleted = quest.completed;
    quest.current = Math.min(quest.target, quest.current + amount);
    if (quest.current >= quest.target) {
      quest.completed = true;
      if (!wasCompleted) {
        newlyCompleted.push({ scope, quest });
      }
    }
  }

  qp.stats.lastUpdatedAt = new Date().toISOString();
  await dbPut(STORES.META, qp);
  return { questProgress: qp, newlyCompleted };
}

/**
 * 領取任務獎勵。
 * @param {string} questId
 * @param {'daily'|'weekly'} scope
 * @returns {{ success: boolean, error?: string, quest?: object, reward?: object, scope?: string }}
 */
export async function claimQuestReward(questId, scope) {
  const qp = await getQuestProgress();
  const bucket = scope === 'weekly' ? qp.weekly : qp.daily;
  const quest = bucket?.quests?.[questId];

  if (!quest) {
    return { success: false, error: '找不到這個冒險任務' };
  }
  if (!quest.completed) {
    return { success: false, error: '任務尚未完成，無法領取' };
  }
  if (quest.claimed) {
    return { success: false, error: '獎勵已領取' };
  }

  const def = getDefById(scope, questId);
  const reward = def?.reward || {};

  try {
    await applyRewardBundle(reward);
  } catch (err) {
    return { success: false, error: err?.message || '獎勵發放失敗' };
  }

  quest.claimed = true;
  if (scope === 'weekly') {
    qp.stats.totalWeeklyQuestsClaimed = toSafeInt(qp.stats.totalWeeklyQuestsClaimed) + 1;
  } else {
    qp.stats.totalDailyQuestsClaimed = toSafeInt(qp.stats.totalDailyQuestsClaimed) + 1;
  }
  qp.stats.lastUpdatedAt = new Date().toISOString();
  await dbPut(STORES.META, qp);

  return { success: true, quest, reward, scope };
}

/** 將單一 quest 轉為含狀態與獎勵的顯示物件 */
function toQuestView(quest, scope) {
  const def = getDefById(scope, quest.id);
  let status = 'in_progress';
  if (quest.claimed) status = 'claimed';
  else if (quest.completed) status = 'claimable';
  return {
    id: quest.id,
    type: quest.type,
    title: quest.title,
    description: quest.description,
    current: Math.min(quest.current, quest.target),
    target: quest.target,
    completed: quest.completed,
    claimed: quest.claimed,
    status,
    reward: def?.reward || {},
    scope,
  };
}

/**
 * 取得供 UI 使用的任務摘要。
 */
export async function getQuestSummary() {
  const qp = await getQuestProgress();

  const buildScope = (bucket, defs, scope) => {
    const items = defs
      .map((def) => bucket.quests[def.id])
      .filter(Boolean)
      .map((q) => toQuestView(q, scope));
    const total = items.length;
    const completedCount = items.filter((q) => q.completed).length;
    const claimableCount = items.filter((q) => q.status === 'claimable').length;
    return { items, total, completedCount, claimableCount };
  };

  const daily = buildScope(qp.daily, DAILY_QUEST_DEFS, 'daily');
  const weekly = buildScope(qp.weekly, WEEKLY_QUEST_DEFS, 'weekly');

  return {
    dateKey: qp.daily.dateKey,
    weekKey: qp.weekly.weekKey,
    daily,
    weekly,
    totalClaimable: daily.claimableCount + weekly.claimableCount,
    stats: { ...qp.stats },
  };
}

/** 匯出 questProgress（備份用） */
export async function exportQuestProgress() {
  return getQuestProgress();
}
