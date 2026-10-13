import { FAIRY_MOTIFS } from './auroraFairyScene.js';
import { CHAOS_MOTIFS } from './chaosDemonCourtScene.js';
import { SWORDWILD_AWAKENING_IDS, DARKCOURT_AWAKENING_IDS, FAIRY_AWAKENING_IDS } from './petAwakeningProfiles.js';
import { AWAKENING_PET_IDS } from './petAwakeningCore.js';
let catalog;
let loading;
export function validateAwakeningCatalog(data) {
  if (data?.schemaVersion !== 1 || !Array.isArray(data.pets)) return ['覺醒目錄格式無效'];
  const ids = data.pets.map(p=>p?.petId);
  const darkCount = ids.filter(id=>DARKCOURT_AWAKENING_IDS.includes(id)).length;
  const fairyCount = ids.filter(id=>FAIRY_AWAKENING_IDS.includes(id)).length;
  if (!SWORDWILD_AWAKENING_IDS.every(id=>ids.includes(id)) || ![0, DARKCOURT_AWAKENING_IDS.length].includes(darkCount)
    || ![0, FAIRY_AWAKENING_IDS.length].includes(fairyCount)
    || data.pets.length !== SWORDWILD_AWAKENING_IDS.length + darkCount + fairyCount) return ['覺醒目錄須包含完整已開放系列角色'];
  const seen = new Set();
  const errors = [];
  for (const p of data.pets) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) { errors.push('覺醒內容必須是角色物件'); continue; }
    if (!AWAKENING_PET_IDS.includes(p?.petId) || seen.has(p.petId)) errors.push('覺醒角色重複或無效');
    seen.add(p.petId);
    if (DARKCOURT_AWAKENING_IDS.includes(p.petId) && (!p.awakenedImage || !CHAOS_MOTIFS.includes(p.visual?.replace(/^chaos_/, ''))
      || p.rarity !== (p.petId.startsWith('pet_ur') ? 'UR' : 'SSR'))) errors.push(`${p.petId}: 魔獸／人形配對內容不完整`);
    if (FAIRY_AWAKENING_IDS.includes(p.petId) && (!p.awakenedImage || !FAIRY_MOTIFS.includes(p.visual?.replace(/^fairy_/, ''))
      || p.rarity !== (p.petId.startsWith('pet_ur') ? 'UR' : 'SSR'))) errors.push(`${p.petId}: 靈獸／仙女配對內容不完整`);
    if (![p.name, p.invitation, p.trialTitle, p.tokenName, p.title, p.signature, p.visual].every((v) => typeof v === 'string' && v.trim())
      || !Array.isArray(p.story) || p.story.length < 2 || !p.story.every((v) => typeof v === 'string' && v.trim())
      || !Array.isArray(p.dialogue) || p.dialogue.length < 3 || !p.dialogue.every((v) => typeof v === 'string' && v.trim())
      || !/^assets\/pets\/awakening\/[a-z0-9_-]+\.png$/.test(p.initialImage?.original || '')
      || !['card', 'stage'].every((k) => /^assets\/pets\/awakening\/[a-z0-9_-]+\.webp$/.test(p.initialImage?.[k] || ''))
      || !/^[a-f0-9]{64}$/.test(p.initialSha256 || '')) errors.push(`${p.petId}: 覺醒內容不完整`);
    if (p.awakenedImage && (!/^[a-f0-9]{64}$/.test(p.awakenedSha256 || '')
      || !/^assets\/pets\/awakening\/[a-z0-9_-]+\.png$/.test(p.awakenedImage.original || '')
      || !['card', 'stage'].every((k) => /^assets\/pets\/awakening\/[a-z0-9_-]+\.webp$/.test(p.awakenedImage[k] || '')))) errors.push(`${p.petId}: 覺醒圖格式無效`);
  }
  return errors;
}
export async function loadAwakeningCatalog() {
  if (catalog) return catalog;
  if (!loading) loading = (async () => {
    const r = await fetch(new URL('../data/pet-awakening.json', import.meta.url));
    if (!r.ok) throw Error('覺醒故事暫時無法載入');
    const value = await r.json();
    const errors = validateAwakeningCatalog(value);
    if (errors.length) throw Error(errors.join('；'));
    catalog = value;
    return value;
  })().finally(() => { loading = null; });
  return loading;
}
