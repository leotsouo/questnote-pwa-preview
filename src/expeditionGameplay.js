/** Expedition planning is pure so the same rules can drive dispatch and reports. */
export const EXPEDITION_OBJECTIVES = Object.freeze({
  explore: { label: '探索', description: '優先尋找新路線與故事', role: 'scout', benefit: '增加地區探索進度' },
  gather: { label: '採集', description: '優先帶回地區素材', role: 'gatherer', benefit: '多帶回地區素材' },
  bond: { label: '羈絆', description: '讓同行夥伴累積更多親密度', role: 'companion', benefit: '增加隊伍親密度' },
});

export const SPECIALTY_LABELS = Object.freeze({
  scout: '探路', gatherer: '採集', companion: '同行', scholar: '解讀', guardian: '守護',
});

const ELEMENT_ROLES = [
  { words: ['火', '焰', 'lava', 'fire'], role: 'guardian' },
  { words: ['機械', '鋼', '齒輪', 'machine'], role: 'scholar' },
  { words: ['冰', '雪', '極', 'frost'], role: 'scout' },
  { words: ['木', '草', '稻', '田', 'sprout'], role: 'gatherer' },
  { words: ['星', '光', 'astral'], role: 'companion' },
];
const RARITY_BONUS = { N: 0, R: 0.02, SR: 0.04, SSR: 0.06, UR: 0.08 };
const AREA_DISCOVERIES = {
  aurora_feast_garden: "雲橋盡頭的舊食譜只畫了兩副碗筷：真正留住香氣的是等待與共食。",
  darkcrown_border: '界石裂縫仍映出七地各自的顏色；裂冠的黑影尚未抹去任何一條歸路。',
  lionheart_city: '封存試驗紀錄指出，人工翼設計已從模仿格里芬轉向突破格里芬。',
  mist_forest: '霧中露出一條通往古石碑的小路。',
  lava_rift: '火脈短暫平靜，岩壁顯出新的熔岩紋路。',
  machine_ruins: '沉睡的齒輪轉動，露出封存的資料室。',
  astral_rift: '漂浮星光排列成一幅未完成的星圖。',
  polar_shore: '風雪散開，極光下出現一段舊航路。',
  harvest_fields: '田埂的守望記號指向村落留下的祕密倉庫。',
  cloudrest_trail: '竹亭下的舊旅圖指向一處可以避雨、採集嫩葉的山道。',
};

export function getPetSpecialty(pet) {
  const text = [pet.element, pet.speciesType, pet.name, ...(pet.poolTags || [])].join(' ').toLowerCase();
  const explicitRole = Object.hasOwn(SPECIALTY_LABELS, pet.expeditionSpecialty) ? pet.expeditionSpecialty : null;
  const role = explicitRole || ELEMENT_ROLES.find((entry) => entry.words.some((word) => text.includes(word)))?.role
    || ['scout', 'gatherer', 'companion', 'scholar', 'guardian'][hashText(pet.id || '') % 5];
  const bondLevel = Math.max(1, Math.min(5, Number(pet.bondLevel) || 1));
  const legacyFloor = Math.max(1, Math.min(5, Number(pet.legacySpecialtyFloor) || (pet.encounterMigrationVersion !== 1 ? Number(pet.stars) : 1) || 1));
  const level = Math.max(bondLevel, legacyFloor);
  return { role, label:SPECIALTY_LABELS[role], level,
    description:`親密度培養專長 Lv.${level}` };
}

function hashText(text) {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

/** Only available, owned pets can be recommended; specialty strength comes first. */
export function getExpeditionRecommendations(pets, objective = 'explore', { companionId, unavailablePetIds = [] } = {}) {
  if (!Object.hasOwn(EXPEDITION_OBJECTIVES, objective)) throw new Error('探險目標不存在');
  const target = EXPEDITION_OBJECTIVES[objective];
  const unavailable = new Set(unavailablePetIds);
  const rarityRank = { N: 1, R: 2, SR: 3, SSR: 4, UR: 5 };
  const candidates = pets.filter((pet) => pet.owned && !unavailable.has(pet.id)).map((pet) => ({
    pet, specialty: getPetSpecialty(pet),
  }));
  candidates.sort((a, b) => {
    const matching = Number(b.specialty.role === target.role) - Number(a.specialty.role === target.role);
    return matching || b.specialty.level - a.specialty.level
      || Number(b.pet.id === companionId) - Number(a.pet.id === companionId)
      || (rarityRank[b.pet.rarity] || 0) - (rarityRank[a.pet.rarity] || 0)
      || (b.pet.bondLevel || 1) - (a.pet.bondLevel || 1)
      || a.pet.id.localeCompare(b.pet.id);
  });
  const recommended = candidates.filter(({ specialty }) => specialty.role === target.role).map(({ pet }) => pet);
  const others = candidates.filter(({ specialty }) => specialty.role !== target.role).map(({ pet }) => pet);
  return { recommended, others, teamPetIds: recommended.slice(0, 3).map((pet) => pet.id),
    role: target.role, label: SPECIALTY_LABELS[target.role], benefit: target.benefit };
}

export function getDispatchTerms(area, firstJourney = false) {
  return firstJourney && area.id === 'mist_forest'
    ? { energyCost: 1, durationMinutes: 3, firstJourney: true }
    : { energyCost: area.energyCost, durationMinutes: area.durationMinutes, firstJourney: false };
}

export function planExpeditionResult(area, pets, objective = 'explore', random = Math.random) {
  if (!Object.hasOwn(EXPEDITION_OBJECTIVES, objective)) throw new Error('探險目標不存在');
  if (!Array.isArray(pets) || pets.length < 1 || pets.length > 3) throw new Error('請選擇 1～3 隻寵物');
  const specialties = pets.map(getPetSpecialty);
  const matchingRole = EXPEDITION_OBJECTIVES[objective].role;
  const rolePower = specialties.filter((s) => s.role === matchingRole).reduce((sum, s) => sum + s.level, 0);
  const scholarPower = specialties.filter((s) => s.role === 'scholar').reduce((sum, s) => sum + s.level, 0);
  const guardianPower = specialties.filter((s) => s.role === 'guardian').reduce((sum, s) => sum + s.level, 0);
  const specialtyPower = specialties.reduce((sum, s) => sum + s.level - 1, 0);
  const variety = new Set(specialties.map((s) => s.role)).size;
  const roll = (min, max) => min + Math.floor(random() * (max - min + 1));
  const baseStardust = roll(area.rewards.stardust.min, area.rewards.stardust.max);
  const rarityBonus = Math.max(...pets.map((p) => RARITY_BONUS[p.rarity] ?? 0));
  const bondBonus = Math.min(0.08, pets.reduce((sum, p) => sum + Math.max(0, (p.bondLevel || 1) - 1) * 0.01, 0));
  const totalBonus = rarityBonus + bondBonus;
  const bonusStardust = Math.floor(baseStardust * totalBonus) + guardianPower * 2 + specialtyPower;
  const material = area.rewards.material;
  const baseMaterial = roll(Math.max(1, material.min), Math.max(1, material.max));
  const extraMaterial = objective === 'gather' ? 1 + Math.ceil(rolePower / 2) : 0;
  const bondExp = area.rewards.bondExp + (objective === 'bond' ? 4 + rolePower * 2 : 0);
  const explorationBonus = (objective === 'explore' ? 2 + rolePower : Math.floor(scholarPower / 2));
  const eventChance = Math.min(0.85, 0.18 + 0.07 * variety + 0.05 * rolePower + 0.03 * scholarPower + 0.01 * specialtyPower);
  const discovered = random() < eventChance;
  const event = discovered
    ? { id: `${area.id}_${objective}_${specialties[0].role}`, title: '隊伍的額外發現',
      text: `${pets.map((p) => p.name).join('、')}${rolePower > 0 ? `發揮${SPECIALTY_LABELS[matchingRole]}專長，` : '合力前行，'}${AREA_DISCOVERIES[area.id] || '發現了新的線索。'}` }
    : { id: `${area.id}_steady`, title: '平安歸來', text: area.id === 'darkcrown_border' ? '隊伍沿著抵抗侵蝕的界線歸來，帶回仍保留暖意的補給；王庭的黑塔仍在遠方。' : area.id === 'lionheart_city' ? '隊伍巡查獅心城公共管線，帶回回收零件；研究區的壓力仍在升高。' : '隊伍沿著熟悉的路線前進，帶回了穩定收穫。' };
  const eventMaterial = discovered && (objective === 'gather' || scholarPower > 0) ? 1 : 0;
  return {
    rewards: { stardust: baseStardust + bonusStardust, baseStardust, bonusStardust,
      rarityBonus, bondBonus, totalBonus, materials: { [material.id]: baseMaterial + extraMaterial + eventMaterial },
      bondExp, fragmentGained: 0, petId: pets[0].id },
    bondByPet: Object.fromEntries(pets.map((pet) => [pet.id, bondExp])),
    explorationGain: explorationBonus,
    event,
    specialtySummary: specialties.map((s, i) => ({ petId: pets[i].id, role: s.role, level: s.level })),
  };
}
