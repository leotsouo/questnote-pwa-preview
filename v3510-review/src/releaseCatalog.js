/** Load one validated content generation before exposing any of it to gameplay. */
import { RELEASE_PROFILE } from './releaseProfile.js';
import { validatePoolContent, POOL_CONTENT_SCHEMA_VERSION } from './poolContentContract.js';
import { validatePetCatalog, validateLoreCatalog, validateSeriesCatalog,
  validatePetAndLoreConsistency, collectPoolTagsFromPools } from './petDataSchema.js';

export const CONTENT_BUNDLE_SCHEMA_VERSION = 1;
const HASH = /^[a-f0-9]{64}$/;
const PROFILES = {
  production: { dbName: 'QuestNoteDB', cacheNamespace: 'questnote-production-' },
  preview: { dbName: 'QuestNotePreviewDB', cacheNamespace: 'questnote-preview-' },
};

export function validateReleaseProfile(profile) {
  const expected = typeof profile?.profile === 'string' && Object.hasOwn(PROFILES, profile.profile)
    ? PROFILES[profile.profile] : null;
  if (!expected || profile.schemaVersion !== 1 || !HASH.test(profile.artifactId)
    || !HASH.test(profile.contentBundleSha256) || !/^[a-f0-9]{40}$/.test(profile.sourceCommit)
    || profile.runtimeContentSchema !== POOL_CONTENT_SCHEMA_VERSION
    || profile.dbName !== expected.dbName || profile.cacheNamespace !== expected.cacheNamespace
    || typeof profile.scopePath !== 'string' || !/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(profile.scopePath)
    || profile.contentBundleUrl !== `data/releases/${profile.contentBundleSha256}/catalog.json`) {
    throw new Error('Invalid or incompatible release profile');
  }
  return profile;
}

export function validateContentBundle(bundle) {
  const errors = [];
  if (bundle?.schemaVersion !== CONTENT_BUNDLE_SCHEMA_VERSION) errors.push('Unsupported content bundle version');
  const { petsData, poolsData, loreData, seriesCatalog } = bundle || {};
  if (!Array.isArray(petsData?.pets) || !Array.isArray(loreData?.lore)
    || !Array.isArray(seriesCatalog?.series) || !Array.isArray(poolsData?.pools)) {
    return { ok: false, errors: [...errors, 'All four complete catalogs are required'] };
  }
  if ([...petsData.pets, ...loreData.lore, ...seriesCatalog.series, ...poolsData.pools]
    .some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
    return { ok: false, errors: [...errors, 'Catalog records must be objects'] };
  }
  const seriesIds = new Set(seriesCatalog.series.map((series) => series.id));
  const knownPoolTags = collectPoolTagsFromPools(poolsData);
  for (const result of [validatePoolContent(poolsData, { pets: petsData.pets }),
    validatePetCatalog(petsData, { mode: 'existing', seriesIds, knownPoolTags }),
    validateLoreCatalog(loreData, { mode: 'existing' }), validateSeriesCatalog(seriesCatalog),
    validatePetAndLoreConsistency(petsData, loreData)]) {
    errors.push(...result.errors.map((error) => error.message || String(error)));
  }
  return { ok: errors.length === 0, errors };
}

export async function sha256Bytes(bytes, cryptoImpl = globalThis.crypto) {
  const digest = await cryptoImpl.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function loadCatalogBundle({ profile = RELEASE_PROFILE,
  fetchImpl = globalThis.fetch, baseUrl = new URL('../', import.meta.url), cryptoImpl = globalThis.crypto } = {}) {
  let bundle;
  if (profile) {
    validateReleaseProfile(profile);
    const base = new URL(baseUrl);
    if (base.pathname !== profile.scopePath) throw new Error('Release scope does not match this deployment');
    const response = await fetchImpl(new URL(profile.contentBundleUrl, base));
    if (!response.ok) throw new Error(`Content bundle unavailable (${response.status})`);
    const bytes = await response.arrayBuffer();
    if (await sha256Bytes(bytes, cryptoImpl) !== profile.contentBundleSha256) throw new Error('Content bundle integrity mismatch');
    bundle = JSON.parse(new TextDecoder().decode(bytes));
  } else {
    // Source checkouts have no release artifact. Never use this fallback for a built release.
    const names = ['pets', 'pools', 'pets-lore', 'pet-series'];
    const values = await Promise.all(names.map(async (name) => {
      const response = await fetchImpl(new URL(`data/${name}.json`, baseUrl));
      if (!response.ok) throw new Error(`Catalog unavailable: ${name}`);
      return response.json();
    }));
    bundle = { schemaVersion: CONTENT_BUNDLE_SCHEMA_VERSION, petsData: values[0],
      poolsData: values[1], loreData: values[2], seriesCatalog: values[3] };
  }
  const validation = validateContentBundle(bundle);
  if (!validation.ok) throw new Error(`Invalid content bundle: ${validation.errors.slice(0, 3).join('; ')}`);
  return bundle;
}
