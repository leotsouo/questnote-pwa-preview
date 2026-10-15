/**
 * 寵物 lore 資料載入與合併
 * 資料來源：data/pets-lore.json（與 pets.json 以 id 對應）
 */

/** 依任務狀態選擇台詞情境 */
export function getDialogueContext(tasks, todayCompleted) {
  const incomplete = tasks.filter((t) => !t.completed);
  if (incomplete.some((t) => t.priority === 'urgent')) return 'urgent';
  if (incomplete.some((t) => t.priority === 'important')) return 'important';
  if (todayCompleted >= 3) return 'praise';
  return 'normal';
}

/**
 * @typedef {object} PetLoreEntry
 * @property {string} id
 * @property {string} title
 * @property {string[]} personality
 * @property {string} element
 * @property {string} lore
 * @property {object} [dialogues]
 * @property {object} [bondUnlocks]
 */

/** 合併單一寵物與 lore */
export function mergePetWithLore(pet, loreEntry) {
  if (!loreEntry) return { ...pet };
  return {
    ...pet,
    title: loreEntry.title ?? '',
    personality: loreEntry.personality ?? [],
    element: loreEntry.element ?? '',
    lore: loreEntry.lore ?? pet.description ?? '',
    dialogues: loreEntry.dialogues ?? {},
    bondUnlocks: loreEntry.bondUnlocks ?? {},
    summonLine: loreEntry.dialogues?.summon ?? loreEntry.summonLine ?? '',
  };
}

/** 合併全部寵物與 lore 資料庫 */
export function mergeAllPetsWithLore(pets, loreData) {
  const loreMap = new Map((loreData.lore ?? []).map((entry) => [entry.id, entry]));
  return pets.map((pet) => mergePetWithLore(pet, loreMap.get(pet.id)));
}

/** 從寵物 dialogues 取情境台詞池 */
export function getPetDialoguePool(pet, context) {
  const dialogues = pet?.dialogues;
  if (!dialogues) return null;

  const pool =
    dialogues[context] ||
    dialogues.idle ||
    dialogues.normal ||
    null;

  return Array.isArray(pool) && pool.length > 0 ? pool : null;
}

/** 取得寵物專屬隨機台詞（無則回傳 null） */
export function getRandomPetDialogue(pet, tasks, todayCompleted) {
  const context = getDialogueContext(tasks, todayCompleted);
  const pool = getPetDialoguePool(pet, context);
  if (!pool) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 取得陪伴卡片預設台詞（寵物專屬優先） */
export function getDefaultPetLine(pet, tasks, todayCompleted) {
  const context = getDialogueContext(tasks, todayCompleted);
  const pool = getPetDialoguePool(pet, context);
  if (pool) return pool[0];
  return null;
}

/** 親密度解鎖文字 */
export function getBondUnlockText(pet, level) {
  return pet?.bondUnlocks?.[String(level)] ?? null;
}

/** 取得已解鎖的親密度段落列表 */
export function getUnlockedBondEntries(pet, bondLevel) {
  const unlocks = pet?.bondUnlocks ?? {};
  return Object.entries(unlocks)
    .filter(([lv]) => Number(lv) <= bondLevel)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([lv, text]) => ({ level: Number(lv), text }));
}

/** 依 id 從 lore 陣列查找 */
export function findLoreById(loreData, petId) {
  return (loreData.lore ?? []).find((e) => e.id === petId) ?? null;
}
