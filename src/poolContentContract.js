/** Pure, versioned pool content contract. No persistence, DOM, or randomness. */
import { getEligiblePetsForPool } from './petPoolFilter.js';

export const POOL_CONTENT_SCHEMA_VERSION = 1;
export const POOL_RARITIES = Object.freeze(['N', 'R', 'SR', 'SSR', 'UR']);
export const POOL_THEME_REGISTRY = Object.freeze({
  default: Object.freeze({ cssTheme: null }),
  dream_bloom: Object.freeze({ cssTheme: 'eternal_slumber_bloom' }),
  glacier_arrival: Object.freeze({ cssTheme: 'glacier_arrival' }),
});
export const POOL_SUMMON_REGISTRY = Object.freeze({ none: true, dream_bloom: true, glacier_arrival: true });
export const POOL_UNLOCK_REGISTRY = Object.freeze({ pool_unlock: true, morning_garden_unlock: true });
export const PET_REVEAL_REGISTRY = Object.freeze({ ssr: true, ur: true, moon: true, petal: true });

const TOKEN = /^[a-z][a-z0-9_]*$/;
const PET_ID = /^pet_(?:(?:n|r|sr|ssr|ur)\d{2,}|sp\d{2,})$/;
const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);
const own = (object, key) => typeof key === 'string' && Object.hasOwn(object, key);
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const token = (value) => typeof value === 'string' && TOKEN.test(value) && !RESERVED.has(value);
const petId = (value) => typeof value === 'string' && PET_ID.test(value);
const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0;
const text = (value) => typeof value === 'string' ? value.trim() : '';
const byId = (pets) => new Map(pets.map((pet) => [pet.id, pet]));
const issue = (code, message, path) => ({ level: 'error', code, message, path });

// This is the only content identity compatibility map. Never add new pools here.
const LEGACY_POOL = Object.freeze({
  id: 'eternal_slumber_bloom',
  key: 'morning_garden',
  grantId: 'awakening_reward:eternal_slumber_bloom:20',
  rewardSource: 'morning_garden_unlock_reward',
  debutLines: Object.freeze(['月皇花', '已於長夜中', '甦醒']),
  presentation: Object.freeze({
    heroPetId: 'pet_ur06',
    featuredPetIds: Object.freeze(['pet_ssr07', 'pet_sr12', 'pet_r16']),
    previewPetIds: Object.freeze(['pet_r16', 'pet_sr12', 'pet_ssr07', 'pet_ur06']),
    progressLabel: '夢塵共鳴',
    candidateLabel: '晨醒角色',
    detailsNote: '永眠＋晨醒候選（不含 standard）',
  }),
});
const LEGACY_REVEALS = Object.freeze({ pet_ur05: 'moon', pet_ur06: 'petal' });
const LEGACY_REVEAL_CAPTIONS = Object.freeze({ pet_ur05: '月下沉眠 · 花庭主人', pet_ur06: '晨曦綻放 · 花庭主人' });
const isLegacyExpansion = (id, expansion) => id === LEGACY_POOL.id && expansion?.key === LEGACY_POOL.key;

export class PoolContentError extends Error {
  constructor(issues) {
    super(issues.map((entry) => `${entry.path}: ${entry.message}`).join('; '));
    this.name = 'PoolContentError';
    this.issues = issues;
  }
}

function checkText(value, path, errors, { required = false } = {}) {
  if ((value !== undefined && typeof value !== 'string') || (required && !text(value))) {
    errors.push(issue('POOL_TEXT_INVALID', 'Expected plain text', path));
  }
  return text(value);
}

function checkList(value, path, errors, validate, { required = false, limit = Infinity } = {}) {
  if (value === undefined && !required) return [];
  if (!Array.isArray(value) || (required && value.length === 0)) {
    errors.push(issue('POOL_LIST_INVALID', 'Expected a nonempty list', path));
    return [];
  }
  if (value.length > limit) errors.push(issue('POOL_LIST_LIMIT', `At most ${limit} entries`, path));
  const seen = new Set();
  value.forEach((entry, index) => {
    if (!validate(entry)) errors.push(issue('POOL_LIST_ENTRY', 'Invalid entry', `${path}[${index}]`));
    if (seen.has(entry)) errors.push(issue('POOL_LIST_DUPLICATE', 'Duplicate entry', `${path}[${index}]`));
    seen.add(entry);
  });
  return [...value];
}

function normalizePresentation(raw, id, errors, path) {
  if (raw === undefined || raw === null) return null;
  if (!record(raw)) {
    errors.push(issue('POOL_PRESENTATION_INVALID', 'Expected an object', path));
    return null;
  }
  const themeKey = raw.themeKey === 'eternal_slumber_bloom' ? 'dream_bloom' : raw.themeKey ?? 'default';
  const animationKey = raw.animationKey ?? 'none';
  if (!own(POOL_THEME_REGISTRY, themeKey)) errors.push(issue('POOL_THEME_UNKNOWN', 'Unknown theme template', `${path}.themeKey`));
  if (!own(POOL_SUMMON_REGISTRY, animationKey)) errors.push(issue('POOL_ANIMATION_UNKNOWN', 'Unknown summon template', `${path}.animationKey`));
  const heroPetId = raw.heroPetId ?? null;
  if (heroPetId !== null && !petId(heroPetId)) errors.push(issue('POOL_PET_ID_INVALID', 'Invalid hero ID', `${path}.heroPetId`));
  const debutDefault = id === LEGACY_POOL.id ? LEGACY_POOL.debutLines : [];
  const debutLines = checkList(raw.debutLines ?? debutDefault, `${path}.debutLines`, errors,
    (line) => typeof line === 'string' && !!line.trim(), { limit: 3 });
  return {
    themeKey, animationKey, heroPetId,
    badge: checkText(raw.badge, `${path}.badge`, errors) || '限定系列',
    eyebrow: checkText(raw.eyebrow, `${path}.eyebrow`, errors),
    tagline: checkText(raw.tagline, `${path}.tagline`, errors),
    featuredPetIds: checkList(raw.featuredPetIds, `${path}.featuredPetIds`, errors, petId, { limit: 4 }),
    debutLines,
    debutLabel: checkText(raw.debutLabel, `${path}.debutLabel`, errors) || (id === LEGACY_POOL.id ? '永眠花海登場' : ''),
    detailsNote: checkText(raw.detailsNote, `${path}.detailsNote`, errors) || (id === LEGACY_POOL.id ? '限定池不含 standard 寵物' : ''),
    candidateNote: checkText(raw.candidateNote, `${path}.candidateNote`, errors)
      || (id === LEGACY_POOL.id ? '限定池不含標準召喚寵物' : ''),
  };
}

function normalizeExpansion(raw, id, errors, path) {
  if (raw === undefined || raw === null) return null;
  if (!record(raw)) {
    errors.push(issue('POOL_EXPANSION_INVALID', 'Expected an object', path));
    return null;
  }
  if (!token(raw.key)) errors.push(issue('POOL_EXPANSION_KEY', 'Invalid stable expansion key', `${path}.key`));
  if (!positiveInteger(raw.threshold)) errors.push(issue('POOL_THRESHOLD_INVALID', 'Expected a positive safe integer', `${path}.threshold`));
  const progressScope = raw.progressScope ?? 'lifetime_pool_draws';
  if (progressScope !== 'lifetime_pool_draws') errors.push(issue('POOL_PROGRESS_SCOPE', 'Unsupported progress scope', `${path}.progressScope`));
  if (!petId(raw.rewardPetId)) errors.push(issue('POOL_REWARD_ID', 'Invalid reward pet ID', `${path}.rewardPetId`));
  const animationKey = raw.animationKey ?? 'pool_unlock';
  if (!own(POOL_UNLOCK_REGISTRY, animationKey)) errors.push(issue('POOL_UNLOCK_ANIMATION', 'Unknown unlock template', `${path}.animationKey`));
  const legacy = isLegacyExpansion(id, raw);
  if (raw.presentation !== undefined && !record(raw.presentation)) {
    errors.push(issue('POOL_UNLOCK_PRESENTATION', 'Expected an object', `${path}.presentation`));
  }
  const view = { ...(legacy ? LEGACY_POOL.presentation : {}), ...(record(raw.presentation) ? raw.presentation : {}) };
  const heroPetId = view.heroPetId ?? null;
  if (heroPetId !== null && !petId(heroPetId)) errors.push(issue('POOL_PET_ID_INVALID', 'Invalid hero ID', `${path}.presentation.heroPetId`));
  return {
    key: raw.key, threshold: raw.threshold, progressScope, rewardPetId: raw.rewardPetId, animationKey,
    extraPoolTags: checkList(raw.extraPoolTags, `${path}.extraPoolTags`, errors, token, { required: true }),
    title: checkText(raw.title, `${path}.title`, errors) || (legacy ? '晨醒花庭' : '卡池擴充'),
    unlockMessage: checkText(raw.unlockMessage, `${path}.unlockMessage`, errors) || (legacy ? '沉眠有歸，甦醒有時。' : ''),
    presentation: {
      heroPetId,
      featuredPetIds: checkList(view.featuredPetIds, `${path}.presentation.featuredPetIds`, errors, petId, { limit: 4 }),
      // null means derive every added candidate; [] deliberately displays no preview.
      previewPetIds: view.previewPetIds == null ? null : checkList(view.previewPetIds, `${path}.presentation.previewPetIds`, errors, petId),
      progressLabel: checkText(view.progressLabel, `${path}.presentation.progressLabel`, errors) || '累積召喚',
      detailsNote: checkText(view.detailsNote, `${path}.presentation.detailsNote`, errors),
      candidateLabel: checkText(view.candidateLabel, `${path}.presentation.candidateLabel`, errors) || '解鎖角色',
    },
  };
}

function parsePool(raw, path, errors) {
  if (!record(raw)) {
    errors.push(issue('POOL_INVALID', 'Expected a pool object', path));
    return null;
  }
  if (!token(raw.id)) errors.push(issue('POOL_ID_INVALID', 'Invalid stable pool ID', `${path}.id`));
  if (typeof raw.active !== 'boolean') errors.push(issue('POOL_ACTIVE_INVALID', 'Expected a boolean', `${path}.active`));
  if (!positiveInteger(raw.cost) || !Number.isSafeInteger(raw.cost * 10)) errors.push(issue('POOL_COST_INVALID', 'Expected a positive cost safe for ten pulls', `${path}.cost`));
  if (!record(raw.rates)) errors.push(issue('POOL_RATES_INVALID', 'Expected rarity rates', `${path}.rates`));
  const rates = {};
  for (const rarity of POOL_RARITIES) {
    const rate = raw.rates?.[rarity];
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0 || rate > 1) {
      errors.push(issue('POOL_RATE_INVALID', 'Expected a finite rate in [0, 1]', `${path}.rates.${rarity}`));
    }
    rates[rarity] = rate;
  }
  const sum = Object.values(rates).reduce((total, rate) => total + (typeof rate === 'number' ? rate : NaN), 0);
  if (!Number.isFinite(sum) || Math.abs(sum - 1) > 1e-9) errors.push(issue('POOL_RATE_SUM', 'Rarity rates must sum to 1', `${path}.rates`));
  const pity = { ssr: raw.pity?.ssr, ur: raw.pity?.ur };
  for (const key of ['ssr', 'ur']) {
    if (!positiveInteger(pity[key])) errors.push(issue('POOL_PITY_INVALID', 'Expected a positive safe integer', `${path}.pity.${key}`));
  }
  if (!(rates.SSR + rates.UR > 0)) errors.push(issue('POOL_SSR_PITY_RATE', 'SSR pity requires a positive SSR + UR rate', `${path}.rates`));
  return {
    id: raw.id,
    name: checkText(raw.name, `${path}.name`, errors, { required: true }),
    active: raw.active, cost: raw.cost, rates, pity,
    petFilter: { poolTags: checkList(raw.petFilter?.poolTags, `${path}.petFilter.poolTags`, errors, token, { required: true }) },
    presentation: normalizePresentation(raw.presentation, raw.id, errors, `${path}.presentation`),
    unlockExpansion: normalizeExpansion(raw.unlockExpansion, raw.id, errors, `${path}.unlockExpansion`),
  };
}

/** Structure validation only. Call validatePoolContent with pets before accepting a catalog. */
export function normalizePoolDefinition(rawPool) {
  const errors = [];
  const pool = parsePool(rawPool, 'pool', errors);
  if (errors.length) throw new PoolContentError(errors);
  return pool;
}

export function normalizeUnlockExpansion(pool) {
  if (!pool) return null;
  return normalizePoolDefinition(pool).unlockExpansion;
}

function effectivePool(pool, unlocked) {
  if (!unlocked || !pool.unlockExpansion) return pool;
  return { ...pool, petFilter: { poolTags: [...new Set([...pool.petFilter.poolTags, ...pool.unlockExpansion.extraPoolTags])] } };
}

export function resolveEffectivePool(rawPool, unlockEntry) {
  if (!rawPool) return null;
  return effectivePool(normalizePoolDefinition(rawPool), unlockEntry?.unlocked === true);
}

export function resolveDrawCost(pool, count) {
  if (count !== 1 && count !== 10) throw new PoolContentError([issue('POOL_DRAW_COUNT', 'Only one or ten pulls are supported', 'count')]);
  if (!positiveInteger(pool?.cost) || !Number.isSafeInteger(pool.cost * 10)) {
    throw new PoolContentError([issue('POOL_COST_INVALID', 'Invalid pool cost', 'pool.cost')]);
  }
  return pool.cost * count;
}

function requireIdentity(poolId, expansion) {
  if (!token(poolId) || !token(expansion?.key)) {
    throw new PoolContentError([issue('POOL_GRANT_IDENTITY', 'Invalid pool or expansion identity', 'unlockExpansion.key')]);
  }
}

export function resolveUnlockGrantId(poolId, expansion) {
  requireIdentity(poolId, expansion);
  return isLegacyExpansion(poolId, expansion) ? LEGACY_POOL.grantId : `awakening_reward:${poolId}:${expansion.key}`;
}

export function resolveUnlockRewardSource(poolId, expansion) {
  requireIdentity(poolId, expansion);
  return isLegacyExpansion(poolId, expansion) ? LEGACY_POOL.rewardSource : `pool_unlock_reward:${poolId}:${expansion.key}`;
}

function parseCatalog(data, path, errors) {
  if (record(data) && data.schemaVersion !== undefined && data.schemaVersion !== POOL_CONTENT_SCHEMA_VERSION) {
    errors.push(issue('POOL_SCHEMA_VERSION', 'Unsupported pool content version', `${path}.schemaVersion`));
  }
  const rawPools = Array.isArray(data) ? data : data?.pools;
  if (!Array.isArray(rawPools)) {
    errors.push(issue('POOL_CATALOG_INVALID', 'Expected a pools array', path));
    return [];
  }
  const ids = new Set();
  return rawPools.map((raw, index) => {
    const pool = parsePool(raw, `${path}.pools[${index}]`, errors);
    if (pool && ids.has(pool.id)) errors.push(issue('POOL_ID_DUPLICATE', 'Duplicate pool ID', `${path}.pools[${index}].id`));
    if (pool) ids.add(pool.id);
    return pool;
  }).filter(Boolean);
}

/** Invalid selected IDs fall back to the first active pool; all-inactive returns null. */
export function resolveActivePool(poolsData, selectedPoolId) {
  const errors = [];
  const pools = parseCatalog(poolsData, 'catalog', errors);
  if (errors.length) throw new PoolContentError(errors);
  const active = pools.filter((pool) => pool.active);
  return active.find((pool) => pool.id === selectedPoolId) ?? active[0] ?? null;
}

function checkReferences(pool, pets, errors, path) {
  const petMap = byId(pets);
  const locked = getEligiblePetsForPool(pets, pool);
  const unlocked = getEligiblePetsForPool(pets, effectivePool(pool, true));
  const lockedIds = new Set(locked.map((pet) => pet.id));
  const unlockedIds = new Set(unlocked.map((pet) => pet.id));
  for (const tag of [...pool.petFilter.poolTags, ...(pool.unlockExpansion?.extraPoolTags ?? [])]) {
    if (!pets.some((pet) => pet.poolTags.includes(tag))) {
      errors.push(issue('POOL_TAG_UNUSED', 'Pool tag has no catalog candidates', path + '.tags.' + tag));
    }
  }
  for (const [phase, candidates] of [['locked', locked], ['unlocked', unlocked]]) {
    if (!candidates.length) errors.push(issue('POOL_EMPTY', 'Pool has no candidates', `${path}.${phase}`));
    for (const rarity of POOL_RARITIES) {
      if ((pool.rates[rarity] > 0 || rarity === 'UR') && !candidates.some((pet) => pet.rarity === rarity)) {
        errors.push(issue('POOL_EMPTY_RARITY', `No ${rarity} candidate for rates or pity`, `${path}.${phase}.${rarity}`));
      }
    }
  }
  const reference = (id, allowedIds, referencePath) => {
    if (id && !petMap.has(id)) errors.push(issue('POOL_REFERENCE_MISSING', 'Referenced pet does not exist', referencePath));
    else if (id && !allowedIds.has(id)) errors.push(issue('POOL_REFERENCE_PHASE', 'Pet is unavailable in this phase', referencePath));
  };
  if (pool.presentation) {
    reference(pool.presentation.heroPetId, lockedIds, `${path}.presentation.heroPetId`);
    pool.presentation.featuredPetIds.forEach((id, index) => reference(id, lockedIds, `${path}.presentation.featuredPetIds[${index}]`));
  }
  if (pool.unlockExpansion) {
    const expansion = pool.unlockExpansion;
    const addedIds = new Set([...unlockedIds].filter((id) => !lockedIds.has(id)));
    if (!addedIds.size) errors.push(issue('POOL_EXPANSION_EMPTY', 'Expansion must add candidates', `${path}.unlockExpansion.extraPoolTags`));
    reference(expansion.rewardPetId, addedIds, `${path}.unlockExpansion.rewardPetId`);
    const view = expansion.presentation;
    reference(view.heroPetId, addedIds, `${path}.unlockExpansion.presentation.heroPetId`);
    view.featuredPetIds.forEach((id, index) => reference(id, unlockedIds, `${path}.unlockExpansion.presentation.featuredPetIds[${index}]`));
    view.previewPetIds?.forEach((id, index) => reference(id, addedIds, `${path}.unlockExpansion.presentation.previewPetIds[${index}]`));
  }
  return { locked: locked.length, unlocked: unlocked.length };
}

/** Full structural and cross-reference validation; never reads or changes product state. */
export function validatePoolContent(poolsData, { pets, previousPoolsData } = {}) {
  const errors = [];
  const pools = parseCatalog(poolsData, 'catalog', errors);
  const previews = [];
  if (!Array.isArray(pets)) errors.push(issue('POOL_PETS_REQUIRED', 'Full pet catalog required', 'pets'));
  const list = Array.isArray(pets) ? pets : [];
  const petIds = new Set();
  list.forEach((pet, index) => {
    if (!petId(pet?.id)) errors.push(issue('POOL_PET_ID_INVALID', 'Invalid pet ID', `pets[${index}].id`));
    if (petIds.has(pet?.id)) errors.push(issue('POOL_PET_ID_DUPLICATE', 'Duplicate pet ID', `pets[${index}].id`));
    petIds.add(pet?.id);
    checkList(pet?.poolTags, `pets[${index}].poolTags`, errors, token, { required: true });
    if (!POOL_RARITIES.includes(pet?.rarity)) errors.push(issue('POOL_PET_RARITY', 'Invalid pet rarity', `pets[${index}].rarity`));
    if (pet?.presentation !== undefined && !record(pet.presentation)) errors.push(issue('PET_PRESENTATION_INVALID', 'Expected an object', `pets[${index}].presentation`));
    checkText(pet?.presentation?.revealCaption, `pets[${index}].presentation.revealCaption`, errors);
    const key = pet?.presentation?.revealKey;
    if (key !== undefined && (!own(PET_REVEAL_REGISTRY, key) || (pet.rarity !== 'UR' && key !== 'ssr') || (key === 'ssr' && pet.rarity !== 'SSR'))) {
      errors.push(issue('PET_REVEAL_INVALID', 'Reveal template does not match rarity', `pets[${index}].presentation.revealKey`));
    }
  });
  // Only dereference structurally valid input. All malformed cases return issues rather than throwing.
  if (!errors.length) {
    pools.forEach((pool, index) => previews.push({ poolId: pool.id, ...checkReferences(pool, list, errors, `catalog.pools[${index}]`) }));
  }
  if (previousPoolsData !== undefined) {
    const previous = parseCatalog(previousPoolsData, 'previousCatalog', errors);
    const current = new Map(pools.map((pool) => [pool.id, pool]));
    for (const old of previous) {
      const next = current.get(old.id);
      if (!next) errors.push(issue('POOL_REMOVED', 'Disable existing pools instead of removing identities', `catalog.${old.id}`));
      else if (old.unlockExpansion && (!next.unlockExpansion || old.unlockExpansion.key !== next.unlockExpansion.key || old.unlockExpansion.rewardPetId !== next.unlockExpansion.rewardPetId)) {
        errors.push(issue('POOL_EXPANSION_IDENTITY_CHANGED', 'Published expansion key and reward must remain stable', `catalog.${old.id}.unlockExpansion`));
      }
    }
  }
  return { ok: errors.length === 0, errors, warnings: [], pools, previews };
}

/** Presentation-only reveal metadata. Low rarities have no SSR+ reveal. */
export function resolvePetRevealKey(pet) {
  const key = pet?.presentation?.revealKey;
  if (key !== undefined) {
    if (!own(PET_REVEAL_REGISTRY, key) || (pet.rarity === 'SSR' ? key !== 'ssr' : pet.rarity !== 'UR' || key === 'ssr')) {
      throw new PoolContentError([issue('PET_REVEAL_INVALID', 'Reveal template does not match rarity', 'pet.presentation.revealKey')]);
    }
    return key;
  }
  if (pet?.rarity === 'SSR') return 'ssr';
  if (pet?.rarity !== 'UR') return null;
  return own(LEGACY_REVEALS, pet.id) ? LEGACY_REVEALS[pet.id] : 'ur';
}

/** Safe presentation metadata; callers render caption with textContent. */
export function resolvePetRevealPresentation(pet) {
  const key = resolvePetRevealKey(pet);
  const errors = [];
  const explicit = checkText(pet?.presentation?.revealCaption, 'pet.presentation.revealCaption', errors);
  if (errors.length) throw new PoolContentError(errors);
  const legacy = own(LEGACY_REVEALS, pet?.id) && LEGACY_REVEALS[pet.id] === key;
  return {
    key,
    caption: explicit || (legacy ? LEGACY_REVEAL_CAPTIONS[pet.id] : key === 'ssr' ? '稀有夥伴降臨' : key ? '傳說夥伴降臨' : ''),
  };
}

/** Pure view model. visualLocked delays presentation only, never candidate eligibility. */
export function resolvePoolPresentationModel(rawPool, allPets, unlockEntry = {}, { visualLocked = false } = {}) {
  const validation = validatePoolContent({ pools: [rawPool] }, { pets: allPets });
  if (!validation.ok) throw new PoolContentError(validation.errors);
  const pool = validation.pools[0];
  const petMap = byId(allPets);
  const locked = getEligiblePetsForPool(allPets, pool);
  const expanded = getEligiblePetsForPool(allPets, effectivePool(pool, true));
  const lockedIds = new Set(locked.map((pet) => pet.id));
  const added = expanded.filter((pet) => !lockedIds.has(pet.id));
  const expansion = pool.unlockExpansion;
  const unlocked = !!expansion && unlockEntry?.unlocked === true;
  const awakened = unlocked && !visualLocked;
  const hero = petMap.get(pool.presentation?.heroPetId) ?? null;
  const dawnHero = awakened ? petMap.get(expansion.presentation.heroPetId) ?? null : null;
  const featuredIds = awakened ? expansion.presentation.featuredPetIds : pool.presentation?.featuredPetIds ?? [];
  const previewPets = expansion ? expansion.presentation.previewPetIds?.map((id) => petMap.get(id)) ?? added : [];
  const rewardPet = expansion ? petMap.get(expansion.rewardPetId) : null;
  const draws = Number.isSafeInteger(unlockEntry?.lifetimeDraws) && unlockEntry.lifetimeDraws >= 0 ? unlockEntry.lifetimeDraws : 0;
  const counts = { locked: locked.length, unlocked: expanded.length, effective: unlocked ? expanded.length : locked.length, added: added.length };
  return {
    poolId: pool.id, poolName: pool.name,
    costs: { single: resolveDrawCost(pool, 1), ten: resolveDrawCost(pool, 10) },
    presentation: pool.presentation,
    cssTheme: POOL_THEME_REGISTRY[pool.presentation?.themeKey ?? 'default'].cssTheme,
    phase: awakened ? 'awakened' : 'slumber',
    awakened, unlocked, counts,
    hero, heroes: [hero, dawnHero].filter(Boolean),
    featured: featuredIds.map((id) => petMap.get(id)),
    eligiblePets: unlocked ? expanded : locked,
    unlock: expansion ? {
      expansion, rewardPet, previewPets,
      grantId: resolveUnlockGrantId(pool.id, expansion),
      rewardSource: resolveUnlockRewardSource(pool.id, expansion),
      progress: { draws, threshold: expansion.threshold, percent: Math.min(100, Math.round(draws / expansion.threshold * 100)) },
      progressText: awakened ? `${expansion.title}已解鎖` : `${expansion.presentation.progressLabel} ${draws}／${expansion.threshold}`,
      description: awakened ? expansion.unlockMessage : `完成 ${expansion.threshold} 次${pool.name}，解鎖 ${added.length} 位${expansion.presentation.candidateLabel}，並固定獲得${rewardPet.name}。`,
      countsText: awakened ? `候選角色：${counts.effective}` : `目前候選：${counts.locked}　解鎖後候選：${counts.unlocked}`,
    } : null,
  };
}
