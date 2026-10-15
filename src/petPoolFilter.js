/**
 * 抽卡池寵物篩選純函式 — 正式抽卡與 Builder／CLI 共用
 * 不依賴 DOM、IndexedDB。
 *
 * 多個 poolTags 語意：OR（符合任一標籤即可）
 */

/**
 * 單隻寵物是否符合卡池 petFilter
 */
export function matchesPetPoolFilter(pet, pool) {
  const tags = pool?.petFilter?.poolTags ?? [];
  if (!Array.isArray(tags) || tags.length === 0) return true;
  const petTags = Array.isArray(pet?.poolTags) ? pet.poolTags : [];
  return petTags.some((tag) => tags.includes(tag));
}

/**
 * 依卡池設定篩選可用寵物（OR）
 */
export function getEligiblePetsForPool(allPets, pool) {
  const list = Array.isArray(allPets) ? allPets : [];
  return list.filter((pet) => matchesPetPoolFilter(pet, pool));
}
