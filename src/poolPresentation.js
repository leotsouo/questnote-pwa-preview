/** Presentation adapters for the shared, pure pool contract. */
import { normalizePoolDefinition, POOL_THEME_REGISTRY } from './poolContentContract.js';

/** Invalid content has no presentation; validation gates draws separately. */
export function normalizePoolPresentation(pool) {
  if (!pool) return null;
  try {
    return normalizePoolDefinition(pool).presentation;
  } catch {
    return null;
  }
}

export function hasPoolPresentation(pool) {
  return normalizePoolPresentation(pool) !== null;
}

export function shouldUseThemedSummon(pool) {
  return ['dream_bloom', 'glacier_arrival'].includes(normalizePoolPresentation(pool)?.animationKey);
}

/** Canonical dream_bloom retains the existing eternal_slumber_bloom CSS theme. */
export function getPoolThemeAttr(pool) {
  const presentation = normalizePoolPresentation(pool);
  return presentation ? POOL_THEME_REGISTRY[presentation.themeKey].cssTheme : null;
}

export function resolvePresentationPets(presentation, allPets) {
  const byId = new Map((Array.isArray(allPets) ? allPets : []).map((pet) => [pet.id, pet]));
  return {
    hero: byId.get(presentation?.heroPetId) ?? null,
    featured: (presentation?.featuredPetIds ?? []).map((id) => byId.get(id)).filter(Boolean),
  };
}
