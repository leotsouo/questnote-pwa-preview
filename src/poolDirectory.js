// Display policy only. Draw rules and saved selection remain owned by gacha services.
import { recommendationState } from './poolRecommendation.js';

export const POOL_NAVIGATION = Object.freeze({
  featuredPoolId: 'aurora_fairy_feast',
  standardPoolId: 'standard',
  // First recommendation window for this feature launch, not the series' historical release.
  recommendation: Object.freeze({ startsAt:'2026-10-10T06:00:00+08:00', endsAt:'2026-10-24T06:00:00+08:00' }),
});

export function poolNavigation(pools, policy = POOL_NAVIGATION, now = Date.now()) {
  const active = pools.filter((row) => row.active);
  const { status } = recommendationState(policy.recommendation, now);
  return {
    featured: status === 'ended' || status === 'invalid' ? null : active.find((row) => row.id === policy.featuredPoolId) || null,
    standard: active.find((row) => row.id === policy.standardPoolId) || null,
    entries: active,
  };
}

export function searchPoolDirectory(pools, query = '') {
  const terms = String(query).normalize('NFKC').trim().toLocaleLowerCase('zh-TW').split(/\s+/).filter(Boolean);
  return pools.filter((row) => {
    const text = `${row.name} ${row.presentation?.tagline || ''}`.normalize('NFKC').toLocaleLowerCase('zh-TW');
    return terms.every((term) => text.includes(term));
  });
}
