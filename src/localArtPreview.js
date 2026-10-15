import { RELEASE_PROFILE } from './releaseProfile.js';

/** The local review server owns this marker. Artifacts can never enable it. */
export function isLocalArtPreview({ profile, origin, marker }) {
  return profile === null && origin === 'http://127.0.0.1:4193' && marker === 'companion-art-session';
}

export const LOCAL_ART_PREVIEW = isLocalArtPreview({
  profile: RELEASE_PROFILE,
  origin: typeof location === 'undefined' ? '' : location.origin,
  marker: typeof document === 'undefined' ? '' : document.querySelector('meta[name="questnote-local-review"]')?.content,
});

let renderer = null;
export function installLocalIdentityRenderer(value) {
  if (!LOCAL_ART_PREVIEW) throw new Error('Local art review is unavailable on this origin');
  renderer = value;
}

export function renderLocalIdentityView(view, state, refresh, actions) {
  if (!LOCAL_ART_PREVIEW || !renderer || !state?.allPets?.length) return false;
  renderer(view, state, refresh, actions);
  return true;
}
