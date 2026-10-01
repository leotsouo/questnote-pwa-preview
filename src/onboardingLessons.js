/** Chapter definitions and read-only teaching previews. Product services own all writes. */
import {
  STAR_UPGRADE_COST, FRAGMENT_BY_RARITY, BOND_LEVEL_THRESHOLDS,
  PET_BOND_EXP_GAIN, PET_COOLDOWN_MS, getPetCooldownRemaining, formatCooldown,
  getBondUnlocksByLevel,
} from './collectionService.js';
import { canCraft, DAILY_BOND_ITEM_LIMIT } from './workshopService.js';
import { isExpeditionTimeComplete } from './expeditionService.js';
import { getDispatchTerms } from './expeditionGameplay.js';

export const LESSONS = Object.freeze([
  { id: 'stars', title: '升星與寵物碎片', summary: '從重複召喚到升星，看懂每隻夥伴的成長。',
    steps: ['fragments', 'cost', 'upgrade'], practice: { upgrade: 'star-upgraded' } },
  { id: 'bond', title: '陪伴與親密度', summary: '撫摸、一起完成任務，逐步解鎖羈絆內容。',
    steps: ['sources', 'pet', 'unlocks'], practice: { pet: 'companion-petted' } },
  { id: 'expedition', title: '組隊探險與旅程報告', summary: '認識隊伍專長、三種目標與領獎，帶回材料升級營地。',
    steps: ['prepare', 'dispatch', 'claim'], practice: { dispatch: 'expedition-started', claim: 'expedition-claimed' } },
  { id: 'workshop', title: '工坊製作與送禮', summary: '查看配方、製作一份禮物，再選擇夥伴贈送。',
    steps: ['materials', 'craft', 'gift'], practice: { craft: 'item-crafted', gift: 'gift-given' } },
]);

export const LESSON_STATUS_LABELS = Object.freeze({
  new: '尚未開始', active: '學習中', paused: '已暫停', understood: '已了解・可再實作', practiced: '已完成實作',
});

export function getLesson(id) {
  return LESSONS.find((lesson) => lesson.id === id) || null;
}

export function normalizeLessonProgress(raw = {}, lesson) {
  return {
    status: Object.hasOwn(LESSON_STATUS_LABELS, raw?.status) ? raw.status : 'new',
    step: lesson.steps.includes(raw?.step) ? raw.step : lesson.steps[0],
    practiced: lesson.steps.filter((step) => lesson.practice[step] && Array.isArray(raw?.practiced) && raw.practiced.includes(step)),
  };
}

export function nextLessonProgress(raw, lesson, practiced = false) {
  const progress = normalizeLessonProgress(raw, lesson);
  const done = new Set(progress.practiced);
  if (practiced && lesson.practice[progress.step]) done.add(progress.step);
  const next = lesson.steps[lesson.steps.indexOf(progress.step) + 1];
  return {
    status: next ? 'active' : Object.keys(lesson.practice).every((step) => done.has(step)) ? 'practiced' : 'understood',
    step: next || progress.step,
    practiced: [...done],
  };
}

const UNLOCK_NAMES = {
  dialogueLv2: '親近台詞', badgeLv3: '羈絆徽章', homeEffectLv4: '首頁陪伴特效',
  bondFrameLv5: '羈絆外框', bondStoryLv5: '羈絆故事',
};

export function getLessonContext(state = {}) {
  const pets = (state.enrichedCollection || []).filter((pet) => pet.owned);
  const upgradeable = pets.filter((pet) => pet.stars < 5);
  const starPet = upgradeable.find((pet) => pet.fragments >= STAR_UPGRADE_COST[pet.stars + 1])
    || upgradeable.find((pet) => pet.isCompanion) || upgradeable[0] || pets[0];
  const craftables = (state.craftablesCatalog || []).filter((item) => item.enabled);
  const craftable = craftables.find((item) => canCraft(item, state.wallet, 1))
    || craftables.find((item) => item.id === 'item_small_spirit_food') || craftables[0];
  const materials = state.wallet?.materials || {};
  const recipe = Object.entries(craftable?.recipe || {}).map(([id, need]) => {
    const material = state.materialsCatalog?.find((item) => item.id === id);
    return { id, name: material?.name || id, source: material?.sourceArea, need, have: materials[id] || 0 };
  });
  const area = state.expeditionAreas?.find((item) => item.id === 'mist_forest');
  const expeditionTerms = area ? getDispatchTerms(area, state.firstJourneyAvailable === true) : null;
  return { pets, starPet, craftable, recipe, area, companion: state.companion,
    expeditionTerms, active: state.activeExpedition, energy: state.wallet?.adventureEnergy || 0 };
}

export function getLessonAvailability(id, state) {
  const c = getLessonContext(state);
  if (id === 'stars') {
    if (!c.starPet) return '先召喚一隻夥伴；現在也能先看懂碎片與升星。';
    if (c.starPet.stars >= 5) return '目前夥伴都已滿星，可以回顧升星規則。';
    const cost = STAR_UPGRADE_COST[c.starPet.stars + 1];
    return c.starPet.fragments >= cost ? '已有足夠碎片，可自願練習升星。' : `升下一星需 ${cost} 個同一夥伴的碎片，目前有 ${c.starPet.fragments || 0} 個。`;
  }
  if (id === 'bond') {
    if (!c.companion) return '先在圖鑑設定陪伴；現在可以了解親密度來源。';
    const remaining = getPetCooldownRemaining(c.companion);
    return remaining > 0 ? `撫摸還需等 ${formatCooldown(remaining)}，可先閱讀解鎖說明。` : '已設定陪伴，現在可以試著撫摸。';
  }
  if (id === 'expedition') {
    if (c.active) return isExpeditionTimeComplete(c.active) ? '探險已結束，可以練習領獎。' : '夥伴正在探險，結束後再回來練習領獎。';
    return c.pets.length && c.expeditionTerms && c.energy >= c.expeditionTerms.energyCost
      ? '已有寵物與足夠能量，可以練習派遣。' : '派遣需要已獲得的寵物與足夠冒險能量。';
  }
  const hasGift = Object.values(state.inventory?.items || {}).some((count) => count > 0);
  if (hasGift && c.pets.length) return '已有禮物庫存，可前往贈送分頁查看可用夥伴。';
  return c.craftable && canCraft(c.craftable, state.wallet, 1)
    ? '已有材料可製作一份禮物。' : '先領取探險材料；材料不足時可先看配方。';
}

/** Values come from live catalogs/services, never from teaching-only rewards. */
export function getLessonStepContent(id, step, state = {}) {
  const c = getLessonContext(state);
  const name = c.starPet?.displayName || c.starPet?.name || '這位夥伴';
  const stars = c.starPet?.stars || 1;
  const cost = STAR_UPGRADE_COST[stars + 1];
  const missing = c.recipe.filter((material) => material.have < material.need);
  const materialList = c.recipe.map((material) => `${material.name} ${material.have}/${material.need}`).join('、');
  const sources = missing.map((material) => `${material.name}還差 ${material.need - material.have}，來源：${material.source || '探險獎勵'}`).join('；');
  const target = { view: 'collection', filter: 'owned', petId: c.starPet?.id };
  const collectionSelector = c.starPet
    ? `.collection-card[data-pet-id="${c.starPet.id}"]` : '#collection-filters';
  const descriptions = {
    'stars/fragments': {
      title: '重複夥伴會變成牠的碎片',
      body: `召喚已獲得的夥伴時，會累積同一隻寵物的碎片。依稀有度：${Object.entries(FRAGMENT_BY_RARITY).map(([rarity, amount]) => `${rarity} +${amount}`).join('、')}。工坊的「星界碎片」是材料，與升星用的寵物碎片分開計算。`,
      target, selector: collectionSelector, action: '查看已獲得圖鑑',
    },
    'stars/cost': {
      title: '先看下一星需要多少碎片',
      body: `升星會消耗該夥伴的碎片。${Object.entries(STAR_UPGRADE_COST).map(([star, amount]) => `升到 ${star} 星需 ${amount} 個`).join('；')}。最高 5 星，星數會記錄在圖鑑與收藏里程中。`,
      target, selector: collectionSelector, action: '查看星數與碎片',
    },
    'stars/upgrade': {
      title: '自願練習一次升星',
      body: !c.starPet ? '目前還沒有夥伴。先召喚、累積同一夥伴的碎片後，再回來練習。'
        : stars >= 5 ? '目前已獲得的夥伴都已達到 5 星。可以完成本章回顧。'
          : `「${name}」目前 ${stars} 星、${c.starPet.fragments || 0} 個碎片；升到 ${stars + 1} 星會花費 ${cost} 個。${c.starPet.fragments >= cost ? '願意實作時，點圖鑑的「升星」並確認花費。' : '碎片不足，可等之後重複召喚累積；不用為了教學額外召喚。'}`,
      target, selector: `${collectionSelector} [data-action="upgrade"]`, action: '查看升星操作',
    },
    'bond/sources': {
      title: '親密度跟著日常累積',
      body: '完成任務會提升目前陪伴夥伴的親密度；撫摸也能增加親密度。探險獎勵給派遣的夥伴，工坊禮物則給你選中的夥伴。首頁進度條顯示目前等級與距離下一級的進度。',
      target: { view: c.companion ? 'tasks' : 'collection', filter: 'owned' }, selector: c.companion ? '#companion-section' : '#collection-filters', action: c.companion ? '查看陪伴與進度' : '前往設定陪伴',
    },
    'bond/pet': {
      title: '試著撫摸你的夥伴',
      body: `撫摸每次增加 ${PET_BOND_EXP_GAIN} 點親密度，冷卻 ${PET_COOLDOWN_MS / 3600000} 小時。${getLessonAvailability('bond', state)} 也能繼續做自己的任務，讓陪伴夥伴一起成長。`,
      target: { view: c.companion ? 'tasks' : 'collection', filter: 'owned' }, selector: c.companion ? '[data-action="companion-pet"]' : '#collection-filters', action: c.companion ? '找到撫摸按鈕' : '前往設定陪伴',
    },
    'bond/unlocks': {
      title: '等級會解鎖新的羈絆內容',
      body: BOND_LEVEL_THRESHOLDS.slice(1).map((exp, index) => {
        const level = index + 2;
        const previous = new Set(getBondUnlocksByLevel(level - 1));
        const names = getBondUnlocksByLevel(level).filter((key) => !previous.has(key) && UNLOCK_NAMES[key]).map((key) => UNLOCK_NAMES[key]);
        return `累積 ${exp} 點到 Lv.${level}：${names.join('、')}`;
      }).join('；') + '。點圖鑑的夥伴資訊，可查看已解鎖內容與故事。',
      target: { view: 'collection', filter: 'owned', petId: c.companion?.id }, selector: '.collection-card [data-action="view-detail"]', action: '查看夥伴詳情入口',
    },
    'expedition/prepare': {
      title: '先確認地區與首次短程行程',
      body: c.area ? `${c.area.name}${c.expeditionTerms.firstJourney ? '首次短程' : '行程'}需要 ${c.expeditionTerms.energyCost} 點能量，歷時 ${c.expeditionTerms.durationMinutes} 分鐘；目前有 ${c.energy} 點。地圖一次顯示一個地區，點「查看地區」可看路線、獎勵與解鎖條件。只要一隻已獲得的夥伴就能出發；同時只能有一趟尚未領獎的探險。` : '前往探險頁，查看地區條件、消耗能量與時間。完成真實任務可以累積冒險能量。',
      target: { view: 'expedition' }, selector: '#expedition-areas', action: '查看探險地區',
    },
    'expedition/dispatch': {
      title: '組隊並選擇探險目標',
      body: `${getLessonAvailability('expedition', state)} 點「查看地區」後，先選探索、採集或羈絆目標，再用「一鍵帶入推薦隊伍」選擇符合專長的夥伴，也可手動調整 1～3 隻隊伍。展開「專長是什麼？」可比較夥伴的隊伍作用；一星也有專長。確認能量花費後才會出發，途中不用操作。`,
      target: { view: 'expedition' }, selector: c.active ? '#expedition-active' : '#expedition-areas [data-area-id="mist_forest"]', action: '查看派遣操作',
    },
    'expedition/claim': {
      title: '閱讀旅程報告並領獎',
      body: `${c.active ? isExpeditionTimeComplete(c.active) ? '目前探險已結束，可以閱讀報告並領獎。' : '目前探險仍在進行；可以先去處理自己的事情。' : '派遣後會顯示倒數，時間到才可閱讀報告並領獎。'} 每趟都有基本收穫，晚點領也不會失去獎勵。材料可投入共用營地，領過的旅程報告會保留在探險頁；探索度與地區里程碑也是下一個目標。`,
      target: { view: 'expedition' }, selector: c.active && isExpeditionTimeComplete(c.active) ? '[data-action="claim-expedition"]' : '#expedition-active', action: '查看倒數與領獎',
    },
    'workshop/materials': {
      title: '先看材料從哪裡取得',
      body: '在「更多 → 工坊 → 材料」查看數量與來源地區。先派遣探險，完成並領獎後材料才會入庫；只派遣還拿不到材料。材料與製作完成的道具分開存放。',
      target: { view: 'workshop', tab: 'materials' }, selector: '#workshop-content', action: '查看材料與來源',
    },
    'workshop/craft': {
      title: '看懂配方，再製作一份',
      body: c.craftable ? `「${c.craftable.name}」配方：${materialList}（持有／需要）。${sources || '材料足夠；點「製作 x1」會扣除配方材料並得到一份禮物。'} 可以先看懂，等材料足夠再製作。` : '目前沒有可用配方。之後可在「製作」查看材料需求；確認消耗後再製作一份。',
      target: { view: 'workshop', tab: 'craft', itemId: c.craftable?.id }, selector: c.craftable ? `[data-action="craft-item"][data-item-id="${c.craftable.id}"][data-qty="1"]` : '#workshop-content', action: '查看製作配方',
    },
    'workshop/gift': {
      title: '選好夥伴與禮物，確認效果',
      body: `切到「贈送」，先選禮物，再從推薦名單選夥伴；主題禮物會說明喜好理由，其他夥伴仍可獲得基本效果。預覽會顯示增加的親密度與可能升級。按「確認贈送 1 份」會消耗 1 份道具；每隻夥伴每天最多 ${DAILY_BOND_ITEM_LIMIT} 份。沒有庫存先製作，達上限可明天再來。`,
      target: { view: 'workshop', tab: 'gift' }, selector: '#workshop-content', action: '查看送禮與預覽',
    },
  };
  return descriptions[`${id}/${step}`] || null;
}
