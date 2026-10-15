/** Chapter definitions and read-only teaching previews. Product services own all writes. */
import {
  BOND_LEVEL_THRESHOLDS,
  PET_BOND_EXP_GAIN, PET_COOLDOWN_MS, getPetCooldownRemaining, formatCooldown,
  getBondUnlocksByLevel,
} from './collectionService.js';
import { ENCOUNTER_FRAGMENTS_BY_RARITY } from './encounterEconomyCore.js';
import { canCraft, DAILY_BOND_ITEM_LIMIT } from './workshopService.js';
import { isExpeditionTimeComplete } from './expeditionService.js';
import { getDispatchTerms } from './expeditionGameplay.js';
import { CHAPTER_LEVELS, CHAPTER_REWARDS, HABIT_TARGETS, DAILY_COMPANION_REWARD } from './bondJourneyCore.js';

export const LESSONS = Object.freeze([
  { id: 'invitation', title: '重逢與指定邀請', summary: '一路相遇，讓下一位同行者由你選擇。', outcome: '學會累積相遇碎片與安全指定邀請', icon: '✦',
    steps: ['fragments', 'cost', 'invite'], practice: { invite: 'companion-invited' } },
  { id: 'bond', title: '陪伴、故事與同行約定', summary: '聽牠的故事，一起完成小事。', outcome: '學會陪伴、故事與同行約定', icon: '♡',
    steps: ['sources', 'pet', 'unlocks', 'story', 'agreement', 'keepsake'], practice: { pet: 'companion-petted' } },
  { id: 'expedition', title: '一起走一段新的旅程', summary: '看地區、選隊伍與目標，旅程結束後讀報告、領收穫。', outcome: '學會派遣與領取旅程收穫', icon: '⌁',
    steps: ['prepare', 'dispatch', 'claim'], practice: { dispatch: 'expedition-started', claim: 'expedition-claimed' } },
  { id: 'workshop', title: '把收穫做成一份心意', summary: '查看材料、製作禮物，再選一位夥伴預覽送禮效果。', outcome: '學會從材料到製作與送禮', icon: '❋',
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
  return { pets, craftable, recipe, area, companion: state.companion,
    expeditionTerms, active: state.activeExpedition, energy: state.wallet?.adventureEnergy || 0 };
}

export function getLessonAvailability(id, state) {
  const c = getLessonContext(state);
  if (id === 'invitation') {
    const balance = state.encounterEconomy?.balance || 0;
    return balance >= 100 ? '已足夠邀請 SSR；也可以繼續累積，等待想同行的夥伴。' : `目前有 ${balance} 枚相遇碎片，再累積 ${100 - balance} 枚可指定邀請 SSR。`;
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
  const missing = c.recipe.filter((material) => material.have < material.need);
  const materialList = c.recipe.map((material) => `${material.name} ${material.have}/${material.need}`).join('、');
  const sources = missing.map((material) => `${material.name}還差 ${material.need - material.have}，來源：${material.source || '探險獎勵'}`).join('；');
  const target = { view: 'gacha' };
  const collectionSelector = '[data-identity-action="invitation"]';
  const storyPet = c.companion || c.pets[0];
  const storyTarget = { view: 'collection', filter: 'owned', petId: storyPet?.id, detail: Boolean(storyPet) };
  const storySelector = storyPet
    ? `[data-bond-open="${storyPet.id}"]` : '#view-collection [data-filter="owned"]';
  const descriptions = {
    'invitation/fragments': {
      title: '每次重逢，留下相遇的光痕',
      body: `第一次相遇加入收藏；再次相遇留下跨卡池共用的相遇碎片：${Object.entries(ENCOUNTER_FRAGMENTS_BY_RARITY).map(([rarity, amount]) => `${rarity} +${amount}`).join('、')}。相遇碎片用來指定邀請新夥伴；工坊的星界碎片仍是獨立材料。`,
      target, selector: collectionSelector, action: '查看指定邀請入口',
    },
    'invitation/cost': {
      title: '下一位同行者，由你決定',
      body: '累積 100 枚可指定邀請 SSR，200 枚可指定邀請 UR。只開放目前正式開放的角色，故事條件仍需先完成；已相遇的夥伴不能再次邀請。指定邀請不改動召喚保底。',
      target, selector: collectionSelector, action: '查看夥伴畫廊',
    },
    'invitation/invite': {
      title: '先認識牠，再送出邀請',
      body: '在指定邀請畫廊選一位夥伴，閱讀名字、稱號與故事，再確認碎片花費。可以先了解，之後再邀請；不用為了教學額外召喚。新夥伴從初識開始，日常陪伴才會培養親密度與探險專長。',
      target, selector: collectionSelector, action: '前往指定邀請',
    },
    'bond/sources': {
      title: '親密度跟著日常累積',
      body: '完成任務會提升目前陪伴夥伴的親密度；撫摸也能增加親密度。探險獎勵給派遣的夥伴，工坊禮物則給你選中的夥伴。首頁進度條顯示目前等級與距離下一級的進度。',
      target: { view: c.companion ? 'tasks' : 'collection', filter: 'owned' }, selector: c.companion ? '#twilight-home' : '#view-collection [data-filter="owned"]', action: c.companion ? '查看陪伴與進度' : '前往設定陪伴',
    },
    'bond/pet': {
      title: '試著撫摸你的夥伴',
      body: `撫摸每次增加 ${PET_BOND_EXP_GAIN} 點親密度，冷卻 ${PET_COOLDOWN_MS / 3600000} 小時。${getLessonAvailability('bond', state)} 也能繼續做自己的任務，讓陪伴夥伴一起成長。`,
      target: { view: c.companion ? 'tasks' : 'collection', filter: 'owned' }, selector: c.companion ? '[data-action="companion-pet"]' : '#collection-filters', action: c.companion ? '找到撫摸按鈕' : '前往設定陪伴',
    },
    'bond/unlocks': {
      title: '慢慢解鎖牠的故事',
      body: BOND_LEVEL_THRESHOLDS.slice(1).map((exp, index) => {
        const level = index + 2;
        const previous = new Set(getBondUnlocksByLevel(level - 1));
        const names = getBondUnlocksByLevel(level).filter((key) => !previous.has(key) && UNLOCK_NAMES[key]).map((key) => UNLOCK_NAMES[key]);
        return `累積 ${exp} 點到 Lv.${level}：${names.join('、')}`;
      }).join('；') + '。親密度 Lv.2～5 各有一章專屬故事；等級達標，並完成、領取前一章約定獎勵後，才能閱讀下一章。滿級也可以從第一章開始。接下來會介紹故事與約定怎麼進行。',
      target: storyTarget, selector: storySelector, action: '查看夥伴詳情入口',
    },
    'bond/story': {
      title: '聽聽牠的心事',
      body: '在任務首頁點「故事與同行」，或在圖鑑點夥伴名稱，再點「閱讀故事與同行約定」。選擇可閱讀的章節，讀完後挑一個回應；沒有標準答案，兩種回應都會走向同一個結局，也能回顧另一種回應。親密度還沒到 Lv.2 時，可以先了解，之後再回來閱讀。',
      target: storyTarget, selector: storySelector, action: '找到故事入口',
    },
    'bond/agreement': {
      title: '選一件小事一起做',
      body: `讀完故事後，選一項尚未完成的任務，或一項啟用中的習慣。任務完成一次即可；習慣依 Lv.${CHAPTER_LEVELS.join('、Lv.')} 章節，分別需 ${CHAPTER_LEVELS.map((level) => HABIT_TARGETS[level]).join('、')} 個不同日期完成，不必連續。接受約定後，回任務或習慣頁照常完成，進度就會累積；接受前或暫停期間的完成不會補算。同時只能有一個約定，沒有期限，也不會因為休息而扣親密度。可暫停再繼續，換目標會從零重新累積。沒有合適目標時，先記下真正想做的事，或稍後再開始。`,
      target: storyTarget, selector: storySelector, action: '查看同行約定入口',
    },
    'bond/keepsake': {
      title: '把同行留在身邊',
      body: `達成約定後，回「故事與同行」領取獎勵。Lv.${CHAPTER_LEVELS.join('、Lv.')} 章節各可領 ${CHAPTER_LEVELS.map((level) => CHAPTER_REWARDS[level]).join('、')} 星塵，每隻夥伴每章限一次，領取後才會開放下一章。完成並領取 Lv.5 的最後一章後，會解鎖專屬紀念物，可展示在首頁與營地；也能開始日常同行，選一項任務或習慣完成一次，再領 ${DAILY_COMPANION_REWARD} 星塵。日常同行每天最多領一次，換寵物也不會增加每日次數。可以先完成教學，之後再慢慢體驗。`,
      target: storyTarget, selector: storySelector, action: '查看故事與獎勵入口',
    },
    'expedition/prepare': {
      title: '先確認地區與首次短程行程',
      body: c.area ? `${c.area.name}${c.expeditionTerms.firstJourney ? '首次短程' : '行程'}需要 ${c.expeditionTerms.energyCost} 點能量，歷時 ${c.expeditionTerms.durationMinutes} 分鐘；目前有 ${c.energy} 點。地圖一次顯示一個地區，點「查看地區」可看路線、獎勵與解鎖條件。只要一隻已獲得的夥伴就能出發；同時只能有一趟尚未領獎的探險。` : '前往探險頁，查看地區條件、消耗能量與時間。完成真實任務可以累積冒險能量。',
      target: { view: 'expedition' }, selector: '#expedition-areas', action: '查看探險地區',
    },
    'expedition/dispatch': {
      title: '組隊並選擇探險目標',
      body: `${getLessonAvailability('expedition', state)} 點「查看地區」後，先選探索、採集或羈絆目標，再用「一鍵帶入推薦隊伍」選擇符合專長的夥伴，也可手動調整 1～3 隻隊伍。展開「專長是什麼？」可比較夥伴的隊伍作用；初識也有專長；親密度會逐步培養能力。確認能量花費後才會出發，途中不用操作。`,
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
  const content = descriptions[`${id}/${step}`];
  if (!content) return null;
  const briefs = {
    'invitation/fragments': '每次重逢，都讓想要的下一次相遇更靠近。',
    'invitation/cost': 'SSR 100 枚、UR 200 枚；跨卡池共用相遇碎片。',
    'invitation/invite': '先認識夥伴，再確認邀請。收藏與親密度分開成長。',
    'bond/sources': '設為陪伴後，完成任務就能一起累積親密度。',
    'bond/pet': !c.companion ? '先到圖鑑選一隻設為陪伴。'
      : getPetCooldownRemaining(c.companion) > 0 ? '夥伴正在休息，可以先往下看。'
        : `輕觸首頁的撫摸按鈕，親密度 +${PET_BOND_EXP_GAIN}。`,
    'bond/unlocks': 'Lv.2 起，每級都有新故事。完成前一章約定並領獎，就能繼續。',
    'bond/story': '打開夥伴故事，選一個想說的回應。沒有對錯，照自己的心意就好。',
    'bond/agreement': '選一項任務或習慣，接受約定後照常完成。沒有期限，休息也沒關係。',
    'bond/keepsake': '完成約定後回來領星塵。走完最後一章，留下專屬紀念物，開啟日常同行。',
    'expedition/prepare': '選一個地區，先看看時間與能量花費。',
    'expedition/dispatch': '選 1～3 隻夥伴與探險目標，確認後出發。',
    'expedition/claim': '旅程結束後回來領獎。晚點來，收穫也會等你。',
    'workshop/materials': '探險領獎後，材料才會放進工坊。',
    'workshop/craft': c.craftable ? `先看「${c.craftable.name}」配方，材料足夠再製作。` : '先看配方，材料足夠再製作。',
    'workshop/gift': '選好禮物與夥伴，確認親密度效果後送出。',
  };
  const tips = {
    'bond/story': ['入口在首頁「故事與同行」，或圖鑑的夥伴詳情。', 'Lv.2 才能閱讀第一章；現在也能先了解。', '兩種回應走向同一個結局，之後可回顧另一種回應。'],
    'bond/agreement': ['任務：選尚未完成的一項，完成一次即可。', `習慣：Lv.${CHAPTER_LEVELS.join('、Lv.')} 分別需 ${CHAPTER_LEVELS.map((level) => HABIT_TARGETS[level]).join('、')} 個不同日期，不必連續。`, '接受前與暫停期間的完成不會補算。', '同時只能有一個約定；可暫停、繼續或結束。換目標會從零累積。'],
    'bond/keepsake': [`章節獎勵：${CHAPTER_LEVELS.map((level) => `Lv.${level} +${CHAPTER_REWARDS[level]}`).join('、')} 星塵。每隻每章限領一次，領取後開放下一章。`, '完成並領取 Lv.5 約定後，可在首頁與營地展示紀念物。', `日常同行：完成一項任務或習慣，再領 ${DAILY_COMPANION_REWARD} 星塵。全角色合計每天一次。`],
  };
  const actions = { 'bond/sources': '查看陪伴', 'bond/pet': c.companion ? '找到撫摸' : '設定陪伴',
    'bond/unlocks': '查看夥伴', 'bond/story': '找到故事', 'bond/agreement': '查看約定', 'bond/keepsake': '查看獎勵' };
  return { ...content, action: actions[`${id}/${step}`] || content.action,
    brief: briefs[`${id}/${step}`], tips: tips[`${id}/${step}`] || [content.body] };
}
