/**
 * 陪伴寵物 — 互動台詞（通用 fallback + 寵物專屬）
 *
 * 備註：companionService 與 companionDialogueService 暫維持分離；
 * 未來若要合併需另開版本評估，本版不合併。
 */
import {
  getDialogueContext,
  getRandomPetDialogue,
  getDefaultPetLine,
} from './loreService.js';

/** 通用台詞（寵物無專屬內容時使用） */
const GENERIC_DIALOGUES = {
  urgent: [
    '緊急任務尚未平息，此刻不容遲疑。',
    '我感知到 urgent 的波動——優先處理那項任務。',
    '戰場上最危險的威脅往往最後才被看見，別讓它等到那時。',
    '你的清單中有必須立即斬斷的羈絆，我與你同行。',
    '時間在流逝，緊急之事不容再拖，出發吧。',
  ],
  important: [
    '重要之事已在等候，完成它們會讓前路更清晰。',
    '我看好你的判斷——先把關鍵任務逐一擊破。',
    '核心目標尚未達成，集中精神，我會守在你身側。',
    '每一項重要任務，都是通往更強的階梯。',
    '別被瑣事分散注意力，重要的事值得優先。',
  ],
  praise: [
    '今日戰果豐碩，你的意志值得這份榮耀。',
    '連續完成多項任務——這才是我選擇的夥伴。',
    '你的節奏穩如磐石，繼續保持這股氣勢。',
    '星塵因你的行動而匯聚，我為你感到驕傲。',
    '今天的你，比昨日更靠近目標一步。',
  ],
  normal: [
    '我在此守候，準備好就開始吧。',
    '每一個完成的任務，都是契約的印記。',
    '不必急於一次做完，穩步前行即可。',
    '你的清單即是戰場，我與你並肩。',
    '休息片刻也無妨，但我們終將再次出發。',
  ],
};

/**
 * 取得隨機互動台詞（陪伴寵物專屬優先）
 * @param {Array} tasks
 * @param {number} todayCompleted
 * @param {object|null} companion - 合併 lore 後的陪伴寵物
 */
export function getRandomDialogue(tasks, todayCompleted, companion = null) {
  const petLine = companion ? getRandomPetDialogue(companion, tasks, todayCompleted) : null;
  if (petLine) return petLine;

  const context = getDialogueContext(tasks, todayCompleted);
  const lines = GENERIC_DIALOGUES[context];
  return lines[Math.floor(Math.random() * lines.length)];
}

/**
 * 取得陪伴卡片預設台詞
 */
export function getDefaultCompanionLine(tasks, todayCompleted, companion = null) {
  const petLine = companion ? getDefaultPetLine(companion, tasks, todayCompleted) : null;
  if (petLine) return petLine;

  const context = getDialogueContext(tasks, todayCompleted);
  if (context === 'urgent') return '…有緊急任務需要你立即處理。';
  if (context === 'important') return '重要的事，等著你完成。';
  if (context === 'praise') return '今天的表現，令人印象深刻。';
  return '準備好就開始今天的任務吧。';
}

/** 親密度升級台詞（寵物專屬優先） */
export function getBondUpLine(companion) {
  const pool = companion?.dialogues?.bondUp;
  if (Array.isArray(pool) && pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return null;
}

export { getDialogueContext };
