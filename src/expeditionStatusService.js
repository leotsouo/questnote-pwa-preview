/**
 * 探險進行中狀態文字 — 依地區輪播
 */

/** @type {Record<string, string[]>} */
export const EXPEDITION_STATUS_LINES = {
  mist_forest: [
    '正在穿越濃霧...',
    '發現微弱的森林氣息...',
    '你的夥伴正在搜尋素材...',
    '樹影之間似乎有星塵反應...',
  ],
  lava_rift: [
    '正在避開熔岩裂縫...',
    '火星在岩壁間跳動...',
    '你的夥伴感應到高溫核心...',
    '裂谷深處傳來低鳴...',
  ],
  machine_ruins: [
    '正在掃描古代裝置...',
    '機械齒輪開始轉動...',
    '你的夥伴發現能源殘片...',
    '遺跡深處亮起藍色光線...',
  ],
  astral_rift: [
    '正在穿越星界裂縫...',
    '星塵正在重新聚合...',
    '你的夥伴聽見遠古回聲...',
    '裂縫深處閃過未知光芒...',
  ],
  polar_shore: [
    '正在踏過結霜的岸線...',
    '極光在風雪中忽明忽滅...',
    '你的夥伴感應到寒潮深處的回響...',
    '冰岸盡頭傳來低沉的潮鳴...',
  ],
  harvest_fields: [
    '正在沿田埂緩緩前行...',
    '稻穗在風裡輕輕作響...',
    '你的夥伴拾起一枚手作護符...',
    '遠方村落傳來黃昏的鐘聲...',
  ],
};

export const EXPEDITION_COMPLETE_MSG = '探險完成！你的夥伴帶回了戰利品。';

/**
 * 取得地區狀態文字池
 * @param {string} areaId
 */
export function getStatusLines(areaId) {
  return EXPEDITION_STATUS_LINES[areaId] || EXPEDITION_STATUS_LINES.mist_forest;
}

/**
 * 隨機取得一則狀態文字
 * @param {string} areaId
 * @param {number} [excludeIndex] - 避免連續相同
 */
export function pickStatusLine(areaId, excludeIndex = -1) {
  const lines = getStatusLines(areaId);
  if (lines.length <= 1) return { text: lines[0], index: 0 };

  let index;
  do {
    index = Math.floor(Math.random() * lines.length);
  } while (index === excludeIndex);

  return { text: lines[index], index };
}

/**
 * 隨機輪播間隔（10～20 秒）
 */
export function randomStatusInterval() {
  return 10000 + Math.floor(Math.random() * 10001);
}
