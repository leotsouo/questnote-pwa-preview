/**
 * 寵物系列資料 Schema 純函式 — QuestNote V3.1.0
 *
 * 正式 App、Health Check、CLI、Pet Series Builder 共用。
 * 不依賴 DOM、IndexedDB、Service Worker。
 * 可於 Browser 與 Node ESM 載入。
 */

import { validatePoolContent, normalizePoolDefinition, resolveEffectivePool, resolvePetRevealPresentation } from './poolContentContract.js';
import { getEligiblePetsForPool as matchPoolCandidates } from './petPoolFilter.js';

export const PET_RARITIES = Object.freeze(['N', 'R', 'SR', 'SSR', 'UR']);

export const PET_ID_TYPES = Object.freeze({
  STANDARD: 'standard',
  SPECIAL_SP: 'special_sp',
});

/** 新寵物對話數量標準 */
export const PET_DIALOGUE_REQUIREMENTS = Object.freeze({
  normal: 5,
  urgent: 5,
  important: 5,
  praise: 5,
  idle: 3,
  bondUp: 2,
});

export const PET_BOND_UNLOCK_LEVELS = Object.freeze(['2', '3', '4', '5']);

export const LEGACY_SERIES_ID = 'legacy';

export const PET_ID_PREFIX_BY_RARITY = Object.freeze({
  N: 'pet_n',
  R: 'pet_r',
  SR: 'pet_sr',
  SSR: 'pet_ssr',
  UR: 'pet_ur',
});

export const PET_SP_PREFIX = 'pet_sp';

const RARITY_SET = new Set(PET_RARITIES);
const SERIES_ID_PATTERN = /^[a-z0-9_]+$/;
const STANDARD_PET_ID_PATTERN = /^pet_(n|r|sr|ssr|ur)(\d{2,})$/;
const SP_PET_ID_PATTERN = /^pet_sp(\d{2,})$/;
const IMAGE_PATH_PATTERN = /^assets\/pets\/[a-z0-9_]+\.png$/i;

/**
 * @typedef {{ level: 'error'|'warning', code: string, message: string, path?: string }} PetIssue
 * @typedef {{ ok: boolean, errors: PetIssue[], warnings: PetIssue[] }} PetValidationResult
 */

export function createIssue(level, code, message, path) {
  const issue = { level, code, message };
  if (path) issue.path = path;
  return issue;
}

export function emptyResult() {
  return { ok: true, errors: [], warnings: [] };
}

export function mergeResults(...results) {
  const out = emptyResult();
  for (const r of results) {
    if (!r) continue;
    out.errors.push(...(r.errors || []));
    out.warnings.push(...(r.warnings || []));
  }
  out.ok = out.errors.length === 0;
  return out;
}

export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validString(value) {
  return isNonEmptyString(value) ? value.trim() : '';
}

/** 舊寵物缺 seriesId 時一律視為 legacy */
export function getPetSeriesId(pet) {
  return isNonEmptyString(pet?.seriesId) ? pet.seriesId.trim() : LEGACY_SERIES_ID;
}

export function isValidSeriesId(seriesId) {
  return typeof seriesId === 'string' && SERIES_ID_PATTERN.test(seriesId);
}

export function isValidPetId(id) {
  if (typeof id !== 'string') return false;
  return STANDARD_PET_ID_PATTERN.test(id) || SP_PET_ID_PATTERN.test(id);
}

export function parsePetId(id) {
  if (typeof id !== 'string') return null;
  const sp = id.match(SP_PET_ID_PATTERN);
  if (sp) {
    return { type: PET_ID_TYPES.SPECIAL_SP, prefix: PET_SP_PREFIX, number: parseInt(sp[1], 10), id };
  }
  const std = id.match(STANDARD_PET_ID_PATTERN);
  if (std) {
    return {
      type: PET_ID_TYPES.STANDARD,
      rarityKey: std[1],
      prefix: `pet_${std[1]}`,
      number: parseInt(std[2], 10),
      id,
    };
  }
  return null;
}

/** 比較 pet ID（依前綴再依編號） */
export function comparePetIds(a, b) {
  const pa = parsePetId(a);
  const pb = parsePetId(b);
  if (!pa && !pb) return String(a).localeCompare(String(b));
  if (!pa) return 1;
  if (!pb) return -1;
  const prefixCmp = pa.prefix.localeCompare(pb.prefix);
  if (prefixCmp !== 0) return prefixCmp;
  return pa.number - pb.number;
}

export function normalizePetForValidation(pet) {
  if (!pet || typeof pet !== 'object') return null;
  return {
    id: typeof pet.id === 'string' ? pet.id.trim() : pet.id,
    name: typeof pet.name === 'string' ? pet.name.trim() : pet.name,
    rarity: typeof pet.rarity === 'string' ? pet.rarity.trim() : pet.rarity,
    image: typeof pet.image === 'string' ? pet.image.trim().replace(/\\/g, '/') : pet.image,
    imageVariants: pet.imageVariants,
    presentation: pet.presentation,
    description: typeof pet.description === 'string' ? pet.description.trim() : pet.description,
    poolTags: Array.isArray(pet.poolTags) ? pet.poolTags.map((t) => (typeof t === 'string' ? t.trim() : t)) : pet.poolTags,
    seriesId: typeof pet.seriesId === 'string' ? pet.seriesId.trim() : pet.seriesId,
    speciesType: typeof pet.speciesType === 'string' ? pet.speciesType.trim() : pet.speciesType,
    element: typeof pet.element === 'string' ? pet.element.trim() : pet.element,
    visualTheme: typeof pet.visualTheme === 'string' ? pet.visualTheme.trim() : pet.visualTheme,
  };
}

export function normalizeLoreForValidation(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const dialogues = entry.dialogues && typeof entry.dialogues === 'object' ? entry.dialogues : {};
  const bondUnlocks = entry.bondUnlocks && typeof entry.bondUnlocks === 'object' ? entry.bondUnlocks : {};
  return {
    id: typeof entry.id === 'string' ? entry.id.trim() : entry.id,
    title: typeof entry.title === 'string' ? entry.title.trim() : entry.title,
    personality: Array.isArray(entry.personality)
      ? entry.personality.map((p) => (typeof p === 'string' ? p.trim() : p))
      : entry.personality,
    element: typeof entry.element === 'string' ? entry.element.trim() : entry.element,
    lore: typeof entry.lore === 'string' ? entry.lore.trim() : entry.lore,
    dialogues: {
      normal: Array.isArray(dialogues.normal) ? dialogues.normal : dialogues.normal,
      urgent: Array.isArray(dialogues.urgent) ? dialogues.urgent : dialogues.urgent,
      important: Array.isArray(dialogues.important) ? dialogues.important : dialogues.important,
      praise: Array.isArray(dialogues.praise) ? dialogues.praise : dialogues.praise,
      idle: Array.isArray(dialogues.idle) ? dialogues.idle : dialogues.idle,
      bondUp: Array.isArray(dialogues.bondUp) ? dialogues.bondUp : dialogues.bondUp,
      summon: typeof dialogues.summon === 'string' ? dialogues.summon.trim() : dialogues.summon,
    },
    bondUnlocks: { ...bondUnlocks },
  };
}

/**
 * 從正式 pets + 工作區 pets 計算下一個 ID（不填補空號）
 * @param {Array} existingPets
 * @param {'standard'|'special_sp'} idType
 * @param {string} [rarity] 一般寵物必填
 */
export function getNextPetId(existingPets, idType, rarity) {
  const pets = Array.isArray(existingPets) ? existingPets : [];
  let prefix;
  if (idType === PET_ID_TYPES.SPECIAL_SP) {
    prefix = PET_SP_PREFIX;
  } else {
    if (!RARITY_SET.has(rarity)) {
      throw new Error(`無法為非法 rarity 分配 ID: ${rarity}`);
    }
    prefix = PET_ID_PREFIX_BY_RARITY[rarity];
  }

  let max = 0;
  for (const pet of pets) {
    const parsed = parsePetId(pet?.id);
    if (!parsed || parsed.prefix !== prefix) continue;
    if (parsed.number > max) max = parsed.number;
  }
  const next = max + 1;
  return `${prefix}${String(next).padStart(2, '0')}`;
}

/** 簡單名稱相似檢查（無外部套件） */
export function arePetNamesSimilar(a, b) {
  const na = normalizeNameForCompare(a);
  const nb = normalizeNameForCompare(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) {
    return Math.min(na.length, nb.length) >= 2;
  }
  const shared = countSharedChars(na, nb);
  const minLen = Math.min(na.length, nb.length);
  if (minLen >= 3 && shared / minLen >= 0.75) return true;
  if (na.length >= 3 && nb.length >= 3) {
    if (na.slice(0, 2) === nb.slice(0, 2) && na.slice(-2) === nb.slice(-2) && shared >= minLen - 1) {
      return true;
    }
  }
  return false;
}

function normalizeNameForCompare(name) {
  if (typeof name !== 'string') return '';
  return name
    .normalize('NFKC')
    .replace(/[\s\u3000·・‧\-—_~～'"「」『』【】\[\]()（）]/g, '')
    .toLowerCase();
}

function countSharedChars(a, b) {
  const counts = new Map();
  for (const ch of a) counts.set(ch, (counts.get(ch) || 0) + 1);
  let shared = 0;
  for (const ch of b) {
    const n = counts.get(ch) || 0;
    if (n > 0) {
      shared += 1;
      counts.set(ch, n - 1);
    }
  }
  return shared;
}

/**
 * 驗證單隻寵物
 * @param {object} pet
 * @param {{ mode?: 'existing'|'new', seriesIds?: Set<string>|string[], knownPoolTags?: Set<string>|string[], pathPrefix?: string }} [options]
 */
export function validatePet(pet, options = {}) {
  const mode = options.mode === 'new' ? 'new' : 'existing';
  const seriesIds = toSet(options.seriesIds);
  const knownPoolTags = options.knownPoolTags ? toSet(options.knownPoolTags) : null;
  const prefix = options.pathPrefix || 'pet';
  const result = emptyResult();
  const p = normalizePetForValidation(pet);
  if (!p) {
    result.errors.push(createIssue('error', 'PET_INVALID', '寵物資料無效', prefix));
    result.ok = false;
    return result;
  }

  if (!isNonEmptyString(p.id)) {
    result.errors.push(createIssue('error', 'PET_ID_MISSING', '缺少寵物 id', `${prefix}.id`));
  } else if (!isValidPetId(p.id)) {
    result.errors.push(createIssue('error', 'PET_ID_FORMAT', `寵物 id 格式錯誤: ${p.id}`, `${prefix}.id`));
  }

  if (!isNonEmptyString(p.name)) {
    result.errors.push(createIssue('error', 'PET_NAME_MISSING', '缺少寵物名稱', `${prefix}.name`));
  }

  if (!RARITY_SET.has(p.rarity)) {
    result.errors.push(createIssue('error', 'PET_RARITY_INVALID', `rarity 不合法: ${p.rarity}`, `${prefix}.rarity`));
  }

  if (!isNonEmptyString(p.image)) {
    result.errors.push(createIssue('error', 'PET_IMAGE_MISSING', '缺少 image', `${prefix}.image`));
  } else {
    const normalizedImage = String(p.image).replace(/\\/g, '/');
    if (!IMAGE_PATH_PATTERN.test(normalizedImage)) {
      result.errors.push(createIssue('error', 'PET_IMAGE_PATH', `image 路徑格式錯誤: ${p.image}`, `${prefix}.image`));
    } else if (isNonEmptyString(p.id)) {
      const expected = `assets/pets/${p.id}.png`;
      if (normalizedImage.toLowerCase() !== expected.toLowerCase()) {
        result.errors.push(createIssue(
          'error',
          'PET_IMAGE_NAME_MISMATCH',
          `圖片檔名必須與 id 相同（期望 ${expected}）`,
          `${prefix}.image`,
        ));
      }
    }
  }

  // Sized display assets are optional so older pet packages remain valid.
  if (p.imageVariants !== undefined) {
    if (!p.imageVariants || typeof p.imageVariants !== 'object' || Array.isArray(p.imageVariants)) {
      result.errors.push(createIssue('error', 'PET_IMAGE_VARIANTS_INVALID', 'imageVariants 必須是物件', `${prefix}.imageVariants`));
    } else {
      for (const [kind, size] of [['card', 384], ['stage', 960]]) {
        const path = p.imageVariants[kind];
        if (path === undefined) continue;
        const pattern = new RegExp(`^assets/pets/variants/${p.id}-${kind}-${size}-[a-f0-9]{12}\\.webp$`, 'i');
        if (typeof path !== 'string' || !pattern.test(path)) {
          result.errors.push(createIssue('error', 'PET_IMAGE_VARIANT_PATH', `${kind} 圖片路徑格式錯誤`, `${prefix}.imageVariants.${kind}`));
        }
      }
    }
  }

  if (p.presentation !== undefined) {
    if (!p.presentation || typeof p.presentation !== 'object' || Array.isArray(p.presentation)) {
      result.errors.push(createIssue('error', 'PET_PRESENTATION_INVALID', 'presentation 必須為物件', prefix + '.presentation'));
    } else {
      try { resolvePetRevealPresentation(p); }
      catch (error) {
        for (const entry of error.issues || []) result.errors.push({ ...entry, path: prefix + '.' + entry.path.replace(/^pet\./, '') });
      }
    }
  }

  if (!isNonEmptyString(p.description)) {
    result.errors.push(createIssue('error', 'PET_DESC_MISSING', '缺少 description', `${prefix}.description`));
  } else if (p.description.length < 12) {
    result.warnings.push(createIssue('warning', 'PET_DESC_SHORT', '描述過短', `${prefix}.description`));
  }

  validatePoolTagsField(p.poolTags, result, `${prefix}.poolTags`, knownPoolTags);

  // seriesId / structural fields — existing vs new
  if (mode === 'new') {
    if (!isNonEmptyString(p.seriesId)) {
      result.errors.push(createIssue('error', 'PET_SERIES_MISSING', '新寵物必須有 seriesId', `${prefix}.seriesId`));
    } else if (!isValidSeriesId(p.seriesId)) {
      result.errors.push(createIssue('error', 'PET_SERIES_FORMAT', `seriesId 格式錯誤: ${p.seriesId}`, `${prefix}.seriesId`));
    } else if (seriesIds && seriesIds.size > 0 && !seriesIds.has(p.seriesId)) {
      result.errors.push(createIssue('error', 'PET_SERIES_UNKNOWN', `seriesId 不存在於目錄: ${p.seriesId}`, `${prefix}.seriesId`));
    }

    if (!isNonEmptyString(p.speciesType)) {
      result.errors.push(createIssue('error', 'PET_SPECIES_MISSING', '新寵物必須有 speciesType', `${prefix}.speciesType`));
    }
    if (!isNonEmptyString(p.element)) {
      result.errors.push(createIssue('error', 'PET_ELEMENT_MISSING', '新寵物必須有 element（內部主題鍵）', `${prefix}.element`));
    }
    if (!isNonEmptyString(p.visualTheme)) {
      result.errors.push(createIssue('error', 'PET_VISUAL_MISSING', '新寵物必須有 visualTheme', `${prefix}.visualTheme`));
    }

    if (Array.isArray(p.poolTags) && !p.poolTags.includes('standard')) {
      result.warnings.push(createIssue(
        'warning',
        'PET_NO_STANDARD',
        '新寵物未加入 standard，不會進入目前標準召喚',
        `${prefix}.poolTags`,
      ));
    }
  } else {
    if (p.seriesId != null && p.seriesId !== '' && !isValidSeriesId(p.seriesId)) {
      result.errors.push(createIssue('error', 'PET_SERIES_FORMAT', `seriesId 格式錯誤: ${p.seriesId}`, `${prefix}.seriesId`));
    } else if (isNonEmptyString(p.seriesId) && seriesIds && seriesIds.size > 0 && !seriesIds.has(p.seriesId)) {
      result.errors.push(createIssue('error', 'PET_SERIES_UNKNOWN', `seriesId 不存在於目錄: ${p.seriesId}`, `${prefix}.seriesId`));
    } else if (!isNonEmptyString(p.seriesId)) {
      result.warnings.push(createIssue('warning', 'PET_SERIES_LEGACY', '缺少 seriesId，執行期視為 legacy', `${prefix}.seriesId`));
    }

    if (!isNonEmptyString(p.speciesType)) {
      result.warnings.push(createIssue('warning', 'PET_SPECIES_LEGACY', '舊寵物缺少 speciesType', `${prefix}.speciesType`));
    }
    if (!isNonEmptyString(p.element)) {
      result.warnings.push(createIssue('warning', 'PET_ELEMENT_LEGACY', '舊寵物缺少 element', `${prefix}.element`));
    }
    if (!isNonEmptyString(p.visualTheme)) {
      result.warnings.push(createIssue('warning', 'PET_VISUAL_LEGACY', '舊寵物缺少 visualTheme', `${prefix}.visualTheme`));
    }
  }

  // SP rarity check: SP id may be SR/SSR/UR (or any), but warn if N/R
  const parsed = parsePetId(p.id);
  if (parsed?.type === PET_ID_TYPES.SPECIAL_SP && (p.rarity === 'N' || p.rarity === 'R')) {
    result.warnings.push(createIssue('warning', 'PET_SP_LOW_RARITY', '特殊 SP 寵物 rarity 為 N/R，請確認是否刻意', `${prefix}.rarity`));
  }
  if (parsed?.type === PET_ID_TYPES.STANDARD) {
    const expectedPrefix = PET_ID_PREFIX_BY_RARITY[p.rarity];
    if (expectedPrefix && parsed.prefix !== expectedPrefix) {
      result.warnings.push(createIssue(
        'warning',
        'PET_ID_RARITY_MISMATCH',
        `一般寵物 id 前綴 ${parsed.prefix} 與 rarity ${p.rarity} 不一致`,
        `${prefix}.id`,
      ));
    }
  }

  result.ok = result.errors.length === 0;
  return result;
}

function validatePoolTagsField(poolTags, result, path, knownPoolTags) {
  if (!Array.isArray(poolTags) || poolTags.length === 0) {
    result.errors.push(createIssue('error', 'PET_POOLTAGS_MISSING', 'poolTags 必須為非空字串陣列', path));
    return;
  }
  const seen = new Set();
  for (let i = 0; i < poolTags.length; i += 1) {
    const tag = poolTags[i];
    if (typeof tag !== 'string' || !tag.trim()) {
      result.errors.push(createIssue('error', 'PET_POOLTAG_EMPTY', `poolTags[${i}] 不可為空`, `${path}[${i}]`));
      continue;
    }
    const trimmed = tag.trim();
    if (seen.has(trimmed)) {
      result.errors.push(createIssue('error', 'PET_POOLTAG_DUP', `poolTags 重複: ${trimmed}`, `${path}[${i}]`));
    }
    seen.add(trimmed);
    if (knownPoolTags && knownPoolTags.size > 0 && !knownPoolTags.has(trimmed)) {
      result.warnings.push(createIssue(
        'warning',
        'PET_POOLTAG_UNUSED',
        `poolTag「${trimmed}」目前沒有任何 Pool 使用，不會產生抽卡效果`,
        `${path}[${i}]`,
      ));
    }
  }
}

/**
 * 驗證單筆 Lore
 * @param {object} entry
 * @param {{ mode?: 'existing'|'new', pathPrefix?: string }} [options]
 */
export function validateLoreEntry(entry, options = {}) {
  const mode = options.mode === 'new' ? 'new' : 'existing';
  const prefix = options.pathPrefix || 'lore';
  const result = emptyResult();
  const e = normalizeLoreForValidation(entry);
  if (!e) {
    result.errors.push(createIssue('error', 'LORE_INVALID', 'Lore 資料無效', prefix));
    result.ok = false;
    return result;
  }

  if (!isNonEmptyString(e.id)) {
    result.errors.push(createIssue('error', 'LORE_ID_MISSING', '缺少 Lore id', `${prefix}.id`));
  }

  if (!isNonEmptyString(e.title)) {
    result.errors.push(createIssue('error', 'LORE_TITLE_MISSING', '缺少 title', `${prefix}.title`));
  }

  if (!Array.isArray(e.personality)) {
    result.errors.push(createIssue('error', 'LORE_PERSONALITY_MISSING', 'personality 必須為陣列', `${prefix}.personality`));
  } else {
    const items = e.personality.filter((p) => typeof p === 'string' && p.trim());
    if (items.length < 1) {
      result.errors.push(createIssue('error', 'LORE_PERSONALITY_EMPTY', 'personality 至少 1 個非空字串', `${prefix}.personality`));
    }
    if (items.length > 3) {
      result.warnings.push(createIssue('warning', 'LORE_PERSONALITY_MANY', 'personality 超過 3 個', `${prefix}.personality`));
    }
    if (mode === 'new' && items.length < 3) {
      result.warnings.push(createIssue('warning', 'LORE_PERSONALITY_FEW', '新寵物建議 3 個 personality', `${prefix}.personality`));
    }
  }

  if (!isNonEmptyString(e.element)) {
    result.errors.push(createIssue('error', 'LORE_ELEMENT_MISSING', '缺少 lore element（顯示屬性）', `${prefix}.element`));
  }

  if (!isNonEmptyString(e.lore)) {
    result.errors.push(createIssue('error', 'LORE_TEXT_MISSING', '缺少 lore 本文', `${prefix}.lore`));
  } else if (e.lore.length < 20) {
    result.warnings.push(createIssue('warning', 'LORE_TEXT_SHORT', 'Lore 過短', `${prefix}.lore`));
  }

  validateDialogues(e.dialogues, result, `${prefix}.dialogues`, mode);
  validateBondUnlocks(e.bondUnlocks, result, `${prefix}.bondUnlocks`);

  result.ok = result.errors.length === 0;
  return result;
}

function validateDialogues(dialogues, result, path, mode) {
  if (!dialogues || typeof dialogues !== 'object') {
    result.errors.push(createIssue('error', 'LORE_DIALOGUES_MISSING', '缺少 dialogues', path));
    return;
  }

  for (const [key, required] of Object.entries(PET_DIALOGUE_REQUIREMENTS)) {
    const list = dialogues[key];
    if (!Array.isArray(list)) {
      result.errors.push(createIssue('error', 'LORE_DIALOGUE_MISSING', `缺少 dialogues.${key}`, `${path}.${key}`));
      continue;
    }
    const trimmed = list.map((s) => (typeof s === 'string' ? s.trim() : ''));
    const emptyIdx = trimmed.findIndex((s, i) => typeof list[i] !== 'string' || !s);
    if (emptyIdx >= 0) {
      result.errors.push(createIssue(
        'error',
        'LORE_DIALOGUE_EMPTY',
        `dialogues.${key}[${emptyIdx}] 必須為非空字串`,
        `${path}.${key}[${emptyIdx}]`,
      ));
    }
    const nonEmpty = trimmed.filter(Boolean);
    if (nonEmpty.length < required) {
      result.errors.push(createIssue(
        'error',
        'LORE_DIALOGUE_SHORT',
        `dialogues.${key} 需要至少 ${required} 句，目前 ${nonEmpty.length}`,
        `${path}.${key}`,
      ));
    } else if (nonEmpty.length > required) {
      result.warnings.push(createIssue(
        'warning',
        'LORE_DIALOGUE_EXTRA',
        `dialogues.${key} 超出標準 ${required} 句（目前 ${nonEmpty.length}）`,
        `${path}.${key}`,
      ));
    }
    const seen = new Set();
    for (let i = 0; i < nonEmpty.length; i += 1) {
      if (seen.has(nonEmpty[i])) {
        result.errors.push(createIssue(
          'error',
          'LORE_DIALOGUE_DUP',
          `dialogues.${key} 有完全重複句子`,
          `${path}.${key}`,
        ));
        break;
      }
      seen.add(nonEmpty[i]);
    }
  }

  if (!isNonEmptyString(dialogues.summon)) {
    result.errors.push(createIssue('error', 'LORE_SUMMON_EMPTY', 'summon 必須為非空字串', `${path}.summon`));
  }
}

function validateBondUnlocks(bondUnlocks, result, path) {
  if (!bondUnlocks || typeof bondUnlocks !== 'object') {
    result.errors.push(createIssue('error', 'LORE_BOND_MISSING', '缺少 bondUnlocks', path));
    return;
  }
  for (const level of PET_BOND_UNLOCK_LEVELS) {
    const value = bondUnlocks[level] ?? bondUnlocks[Number(level)];
    if (!isNonEmptyString(value)) {
      result.errors.push(createIssue(
        'error',
        'LORE_BOND_LEVEL_MISSING',
        `bondUnlocks.${level} 必須為非空字串`,
        `${path}.${level}`,
      ));
    }
  }
  for (const key of Object.keys(bondUnlocks)) {
    if (!PET_BOND_UNLOCK_LEVELS.includes(String(key))) {
      result.warnings.push(createIssue(
        'warning',
        'LORE_BOND_EXTRA',
        `bondUnlocks 含額外等級: ${key}`,
        `${path}.${key}`,
      ));
    }
  }
}

/**
 * 驗證系列目錄項目
 */
export function validatePetSeries(series, options = {}) {
  const prefix = options.pathPrefix || 'series';
  const result = emptyResult();
  if (!series || typeof series !== 'object') {
    result.errors.push(createIssue('error', 'SERIES_INVALID', '系列資料無效', prefix));
    result.ok = false;
    return result;
  }
  if (!isValidSeriesId(series.id)) {
    result.errors.push(createIssue('error', 'SERIES_ID_INVALID', `系列 id 不合法: ${series.id}`, `${prefix}.id`));
  }
  if (!isNonEmptyString(series.name)) {
    result.errors.push(createIssue('error', 'SERIES_NAME_MISSING', '系列名稱不可為空', `${prefix}.name`));
  }
  if (series.order != null && (typeof series.order !== 'number' || !Number.isFinite(series.order))) {
    result.errors.push(createIssue('error', 'SERIES_ORDER_INVALID', 'series.order 必須為數字', `${prefix}.order`));
  }
  if (typeof series.enabled !== 'boolean' && series.enabled != null) {
    result.warnings.push(createIssue('warning', 'SERIES_ENABLED_TYPE', 'enabled 建議為 boolean', `${prefix}.enabled`));
  }
  result.ok = result.errors.length === 0;
  return result;
}

export function validateSeriesCatalog(catalog) {
  const result = emptyResult();
  if (!catalog || typeof catalog !== 'object') {
    result.errors.push(createIssue('error', 'SERIES_CATALOG_INVALID', 'pet-series.json 無效'));
    result.ok = false;
    return result;
  }
  if (catalog.schemaVersion !== 1 && Number(catalog.schemaVersion) !== 1) {
    result.errors.push(createIssue('error', 'SERIES_SCHEMA', `schemaVersion 應為 1，目前 ${catalog.schemaVersion}`));
  }
  if (!Array.isArray(catalog.series)) {
    result.errors.push(createIssue('error', 'SERIES_LIST_MISSING', 'series 必須為陣列'));
    result.ok = false;
    return result;
  }
  const ids = new Set();
  let hasLegacy = false;
  catalog.series.forEach((s, i) => {
    const r = validatePetSeries(s, { pathPrefix: `series[${i}]` });
    result.errors.push(...r.errors);
    result.warnings.push(...r.warnings);
    if (s?.id) {
      if (ids.has(s.id)) {
        result.errors.push(createIssue('error', 'SERIES_ID_DUP', `系列 id 重複: ${s.id}`));
      }
      ids.add(s.id);
      if (s.id === LEGACY_SERIES_ID) hasLegacy = true;
    }
  });
  if (!hasLegacy) {
    result.errors.push(createIssue('error', 'SERIES_LEGACY_MISSING', '系列目錄必須包含 legacy'));
  }
  result.ok = result.errors.length === 0;
  return result;
}

/** 別名 */
export const validatePetSeriesCatalog = validateSeriesCatalog;

/**
 * 驗證寵物清單（catalog 層）
 */
export function validatePetCatalog(petsData, options = {}) {
  const mode = options.mode === 'new' ? 'new' : 'existing';
  const result = emptyResult();
  const pets = Array.isArray(petsData?.pets) ? petsData.pets : Array.isArray(petsData) ? petsData : null;
  if (!pets) {
    result.errors.push(createIssue('error', 'PET_CATALOG_INVALID', 'pets 必須為陣列'));
    result.ok = false;
    return result;
  }

  const ids = new Set();
  const names = new Set();
  const images = new Set();
  const seriesIds = toSet(options.seriesIds);
  const knownPoolTags = options.knownPoolTags ? toSet(options.knownPoolTags) : null;

  pets.forEach((pet, i) => {
    const r = validatePet(pet, {
      mode,
      seriesIds,
      knownPoolTags,
      pathPrefix: `pets[${i}]`,
    });
    result.errors.push(...r.errors);
    result.warnings.push(...r.warnings);

    const id = pet?.id;
    const name = typeof pet?.name === 'string' ? pet.name.trim() : '';
    const image = typeof pet?.image === 'string' ? pet.image.trim().replace(/\\/g, '/') : '';

    if (id) {
      if (ids.has(id)) {
        result.errors.push(createIssue('error', 'PET_ID_DUP', `寵物 ID 重複: ${id}`, `pets[${i}].id`));
      }
      ids.add(id);
    }
    if (name) {
      if (names.has(name)) {
        result.errors.push(createIssue('error', 'PET_NAME_DUP', `寵物名稱完全重複: ${name}`, `pets[${i}].name`));
      }
      names.add(name);
    }
    if (image) {
      if (images.has(image)) {
        result.errors.push(createIssue('error', 'PET_IMAGE_DUP', `圖片路徑重複: ${image}`, `pets[${i}].image`));
      }
      images.add(image);
    }
  });

  result.ok = result.errors.length === 0;
  result.stats = { petCount: pets.length, ids: [...ids] };
  return result;
}

export function validateLoreCatalog(loreData, options = {}) {
  const mode = options.mode === 'new' ? 'new' : 'existing';
  const result = emptyResult();
  const lore = Array.isArray(loreData?.lore) ? loreData.lore : Array.isArray(loreData) ? loreData : null;
  if (!lore) {
    result.errors.push(createIssue('error', 'LORE_CATALOG_INVALID', 'lore 必須為陣列'));
    result.ok = false;
    return result;
  }
  const ids = new Set();
  lore.forEach((entry, i) => {
    const r = validateLoreEntry(entry, { mode, pathPrefix: `lore[${i}]` });
    result.errors.push(...r.errors);
    result.warnings.push(...r.warnings);
    if (entry?.id) {
      if (ids.has(entry.id)) {
        result.errors.push(createIssue('error', 'LORE_ID_DUP', `Lore ID 重複: ${entry.id}`, `lore[${i}].id`));
      }
      ids.add(entry.id);
    }
  });
  result.ok = result.errors.length === 0;
  result.stats = { loreCount: lore.length, ids: [...ids] };
  return result;
}

export function validatePetAndLoreConsistency(petsData, loreData) {
  const result = emptyResult();
  const pets = Array.isArray(petsData?.pets) ? petsData.pets : Array.isArray(petsData) ? petsData : [];
  const lore = Array.isArray(loreData?.lore) ? loreData.lore : Array.isArray(loreData) ? loreData : [];
  const petIds = new Set(pets.map((p) => p?.id).filter(Boolean));
  const loreIds = new Set(lore.map((l) => l?.id).filter(Boolean));

  for (const id of petIds) {
    if (!loreIds.has(id)) {
      result.errors.push(createIssue('error', 'PET_MISSING_LORE', `寵物缺少 Lore: ${id}`));
    }
  }
  for (const id of loreIds) {
    if (!petIds.has(id)) {
      result.errors.push(createIssue('error', 'LORE_ORPHAN', `孤立 Lore（無對應寵物）: ${id}`));
    }
  }
  result.ok = result.errors.length === 0;
  return result;
}

/**
 * 抽卡池共用契約驗證，包含 locked / unlocked 候選與引用。
 */
export function validatePoolCatalog(poolsData, options = {}) {
  return validatePoolContent(poolsData, { pets: options.pets, previousPoolsData: options.previousPoolsData });
}

/**
 * 驗證工作區系列套件（新寵物嚴格模式）
 */
export function validatePetPackage(pkg, options = {}) {
  const result = emptyResult();
  const {
    seriesMeta,
    petsData,
    loreData,
    promptsData,
    officialPets = [],
    officialLore = [],
    seriesCatalog,
    poolsData,
    knownPoolTags,
  } = pkg;

  if (!seriesMeta || typeof seriesMeta !== 'object') {
    result.errors.push(createIssue('error', 'PKG_SERIES_MISSING', '缺少 series.json'));
  } else {
    if (!isValidSeriesId(seriesMeta.seriesId)) {
      result.errors.push(createIssue('error', 'PKG_SERIES_ID', `seriesId 不合法: ${seriesMeta.seriesId}`));
    }
    if (!isNonEmptyString(seriesMeta.seriesName)) {
      result.errors.push(createIssue('error', 'PKG_SERIES_NAME', '缺少 seriesName'));
    }
    if (!isNonEmptyString(seriesMeta.releaseVersion)) {
      result.warnings.push(createIssue('warning', 'PKG_RELEASE_VERSION', '缺少 releaseVersion'));
    }
    if (seriesMeta.rarityPlan && typeof seriesMeta.rarityPlan === 'object') {
      const pets = petsData?.pets || [];
      for (const rarity of PET_RARITIES) {
        const planned = Number(seriesMeta.rarityPlan[rarity] ?? 0);
        const actual = pets.filter((p) => p.rarity === rarity).length;
        if (planned !== actual) {
          result.warnings.push(createIssue(
            'warning',
            'PKG_RARITY_PLAN',
            `rarityPlan.${rarity}=${planned} 與實際 ${actual} 不同`,
          ));
        }
      }
    }
  }

  const seriesIds = new Set([
    ...(seriesCatalog?.series || []).map((s) => s.id),
    seriesMeta?.seriesId,
  ].filter(Boolean));

  const petResult = validatePetCatalog(petsData, {
    mode: 'new',
    seriesIds,
    knownPoolTags: knownPoolTags || collectPoolTagsFromPools(poolsData),
  });
  const loreResult = validateLoreCatalog(loreData, { mode: 'new' });
  const consistency = validatePetAndLoreConsistency(petsData, loreData);

  result.errors.push(...petResult.errors, ...loreResult.errors, ...consistency.errors);
  result.warnings.push(...petResult.warnings, ...loreResult.warnings, ...consistency.warnings);

  // 與正式資料衝突
  const officialIds = new Set(officialPets.map((p) => p.id));
  const officialNames = new Set(officialPets.map((p) => p.name));
  const officialImages = new Set(officialPets.map((p) => String(p.image || '').replace(/\\/g, '/')));
  const officialVisual = new Set(officialPets.map((p) => p.visualTheme).filter(Boolean));
  const workspacePets = petsData?.pets || [];

  for (const pet of workspacePets) {
    if (officialIds.has(pet.id)) {
      result.errors.push(createIssue('error', 'PET_ID_COLLISION', `寵物 ID 與正式資料衝突: ${pet.id}`));
    }
    if (officialNames.has(pet.name)) {
      result.errors.push(createIssue('error', 'PET_NAME_COLLISION', `寵物名稱與正式資料完全重複: ${pet.name}`));
    }
    const img = String(pet.image || '').replace(/\\/g, '/');
    if (officialImages.has(img)) {
      result.errors.push(createIssue('error', 'PET_IMAGE_COLLISION', `圖片路徑與正式資料衝突: ${img}`));
    }
    if (seriesMeta?.seriesId && pet.seriesId && pet.seriesId !== seriesMeta.seriesId) {
      result.errors.push(createIssue('error', 'PET_SERIES_MISMATCH', `${pet.id} seriesId 與系列不符`));
    }
    for (const existing of officialPets) {
      if (arePetNamesSimilar(pet.name, existing.name) && pet.name !== existing.name) {
        result.warnings.push(createIssue(
          'warning',
          'PET_NAME_SIMILAR',
          `名稱「${pet.name}」與既有「${existing.name}」高度相似`,
        ));
      }
    }
    if (pet.visualTheme && officialVisual.has(pet.visualTheme)) {
      result.warnings.push(createIssue(
        'warning',
        'PET_VISUAL_DUP',
        `${pet.id} visualTheme 與既有值完全相同: ${pet.visualTheme}`,
      ));
    }
  }

  // UR 比例
  if (workspacePets.length > 0) {
    const urCount = workspacePets.filter((p) => p.rarity === 'UR').length;
    if (urCount / workspacePets.length > 0.35) {
      result.warnings.push(createIssue('warning', 'PKG_UR_HIGH', `UR 比例偏高（${urCount}/${workspacePets.length}）`));
    }
  }

  // Prompts
  const prompts = promptsData?.prompts || {};
  for (const pet of workspacePets) {
    const entry = prompts[pet.id];
    if (!entry) {
      result.warnings.push(createIssue('warning', 'PROMPT_MISSING', `${pet.id} 缺少 prompt 紀錄`));
    } else {
      if (!isNonEmptyString(entry.prompt)) {
        result.warnings.push(createIssue('warning', 'PROMPT_EMPTY', `${pet.id} prompt 空白`));
      }
      if (!isNonEmptyString(entry.negativePrompt)) {
        result.warnings.push(createIssue('warning', 'NEG_PROMPT_EMPTY', `${pet.id} negativePrompt 空白`));
      }
    }
  }

  // Pool preview safety on merged set
  if (poolsData) {
    const mergedPets = [...officialPets, ...workspacePets];
    const poolResult = validatePoolCatalog(poolsData, {
      pets: mergedPets,
    });
    // Every contract error blocks publication; do not discard new validation codes.
    result.errors.push(...poolResult.errors);
    for (const warn of poolResult.warnings) {
      result.warnings.push(warn);
    }

    for (const pet of workspacePets) {
      let inAnyActive = false;
      for (const pool of poolResult.ok ? poolResult.pools : []) {
        if (!pool.active) continue;
        const eligible = matchPoolCandidates([pet], resolveEffectivePool(pool, { unlocked: true }));
        if (eligible.length > 0) {
          inAnyActive = true;
          break;
        }
      }
      if (!inAnyActive) {
        result.warnings.push(createIssue(
          'warning',
          'PET_NO_ACTIVE_POOL',
          `${pet.id} 未進入任何 active Pool`,
        ));
      }
    }
  }

  // unused official lore collision
  const officialLoreIds = new Set(officialLore.map((l) => l.id));
  for (const entry of loreData?.lore || []) {
    if (officialLoreIds.has(entry.id)) {
      result.errors.push(createIssue('error', 'LORE_ID_COLLISION', `Lore ID 與正式資料衝突: ${entry.id}`));
    }
  }

  result.ok = result.errors.length === 0;
  return result;
}

export function collectPoolTagsFromPools(poolsData) {
  const tags = new Set();
  for (const pool of poolsData?.pools || []) {
    for (const tag of pool?.petFilter?.poolTags || []) {
      if (typeof tag === 'string' && tag.trim()) tags.add(tag.trim());
    }
    // unlockExpansion.extraPoolTags 為有效 poolTag 引用（解鎖後才進候選）
    for (const tag of pool?.unlockExpansion?.extraPoolTags || []) {
      if (typeof tag === 'string' && tag.trim()) tags.add(tag.trim());
    }
  }
  return tags;
}

export function countByRarity(pets) {
  const counts = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0 };
  for (const pet of pets || []) {
    if (RARITY_SET.has(pet?.rarity)) counts[pet.rarity] += 1;
  }
  return counts;
}

export function buildPoolPreview(poolsData, beforePets, afterPets, _legacyMatcher) {
  const pools = Array.isArray(poolsData?.pools) ? poolsData.pools : [];
  const snapshot = (pets) => ({ total: pets.length, byRarity: countByRarity(pets) });
  const added = (before, after) => { const ids = new Set(before.map((pet) => pet.id)); return after.filter((pet) => !ids.has(pet.id)).map((pet) => pet.id); };
  return pools.map((rawPool) => {
    try {
      const pool = normalizePoolDefinition(rawPool);
      const expanded = resolveEffectivePool(pool, { unlocked: true });
      const before = matchPoolCandidates(beforePets, pool);
      const after = matchPoolCandidates(afterPets, pool);
      const beforeExpanded = matchPoolCandidates(beforePets, expanded);
      const afterExpanded = matchPoolCandidates(afterPets, expanded);
      return {
        id: pool.id, name: pool.name, active: pool.active,
        before: snapshot(before), after: snapshot(after), addedIds: added(before, after),
        unlocked: { before: snapshot(beforeExpanded), after: snapshot(afterExpanded), addedIds: added(beforeExpanded, afterExpanded) },
        errors: [],
      };
    } catch (error) {
      return {
        id: rawPool?.id || '', name: rawPool?.name || '', active: rawPool?.active === true,
        before: snapshot([]), after: snapshot([]), addedIds: [],
        unlocked: { before: snapshot([]), after: snapshot([]), addedIds: [] },
        errors: error.issues || [createIssue('error', 'POOL_PREVIEW_INVALID', '無法預覽此卡池')],
      };
    }
  });
}

function toSet(value) {
  if (!value) return new Set();
  if (value instanceof Set) return value;
  if (Array.isArray(value)) return new Set(value);
  return new Set();
}
