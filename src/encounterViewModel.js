import { getEligiblePetsForPool } from './petPoolFilter.js';
import { resolveEffectivePool } from './poolContentContract.js';

export const RARITIES = ['N', 'R', 'SR', 'SSR', 'UR'];

const PUBLIC_INTROS = {
  pet_n01: '棲息於迷霧森林的幼狼，雙眼在夜間泛著幽藍微光。',
  pet_ur19: '生於獅心城外高崖的格里芬，鷹首、巨翼與獅身的力量在牠體內達成平衡。牠以天然羽翼感知風向，守護自己的領域。',
  pet_ssr25: '負責試飛塔與城市高架受力結構的夥伴，厚皮外覆著黃銅工作支架。牠願意支持試飛，也始終留意下方街道的安全。',
};

export function publicIntro(pet) {
  return PUBLIC_INTROS[pet.id] || (pet.description || '').split(/(?<=[。！？])/).slice(0, 2).join('');
}

export function normalGreeting(pet) {
  return Array.isArray(pet.dialogues?.normal) ? pet.dialogues.normal.find((line) => typeof line === 'string' && line.trim()) || '' : '';
}

export function poolCandidates(pets, pool, unlocked = false) {
  return getEligiblePetsForPool(pets, resolveEffectivePool(pool, { unlocked }));
}

export function identityLabel(pet, owned, nickname = '') {
  return [pet.name, pet.title, pet.rarity, owned ? '已相遇' : '尚未相遇', nickname ? `你的暱稱：${nickname}` : ''].filter(Boolean).join('，');
}

export function basePetRate(pet, candidates, pool) {
  const count = candidates.filter((row) => row.rarity === pet.rarity).length;
  return count ? (pool.rates[pet.rarity] || 0) / count : 0;
}

export function duplicateNote(result) {
  return '每次重逢，都讓新的相遇更靠近。';
}


// Native single/ten transactions use different fragment field names. Presentation
// consumes their committed outcomes; it never creates or reapplies rewards.
export function encounterResults(results, collection) {
  return results.map((result) => ({ ...result,
    fragmentsGained: result.fragmentsGained ?? result.duplicateFragments ?? 0,
  }));
}
