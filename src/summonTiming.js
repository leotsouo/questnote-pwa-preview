/** Shared clock: Honeylight complete entries; Lionheart summon ceremonies and reveals. */
export const SUMMON_TIMING = Object.freeze({
  prelude: Object.freeze([650, 750, 900, 700]),
  reducedPrelude: Object.freeze([100, 100, 150, 150]),
  debutFull: 3400,
  debutReduced: 500,
  debutDissolve: 550,
  debutReducedDissolve: 240,
  ssr: 2500,
  ur: 4500,
  reducedSsr: 550,
  reducedUr: 750,
  nextCharacter: 240,
});

export function summonPreludeDurations(reduced = false) {
  return [...(reduced ? SUMMON_TIMING.reducedPrelude : SUMMON_TIMING.prelude)];
}

export function poolDebutDuration(reduced = false) {
  return reduced ? SUMMON_TIMING.debutReduced : SUMMON_TIMING.debutFull;
}

export function poolDebutDissolveDuration(reduced = false) {
  return reduced ? SUMMON_TIMING.debutReducedDissolve : SUMMON_TIMING.debutDissolve;
}

export function summonRevealDuration(rarity, reduced = false) {
  return reduced ? (rarity === 'UR' ? SUMMON_TIMING.reducedUr : SUMMON_TIMING.reducedSsr) : rarity === 'UR' ? SUMMON_TIMING.ur : SUMMON_TIMING.ssr;
}
