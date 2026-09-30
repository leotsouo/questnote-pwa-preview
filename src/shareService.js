export const APP_SHARE_URL = 'https://leotsouo.github.io/questnote-pwa/';
export const WEBSITE_SHARE_URL = 'https://questnote.taste-compare.com/';
export const APP_SHARE_DESCRIPTION = '把生活裡的待辦，變成與夥伴一起成長的冒險。';
export const APP_SHARE_TEXT = `小事完成，冒險繼續。\n${APP_SHARE_DESCRIPTION}`;
export const APP_SHARE_MESSAGE = `${APP_SHARE_TEXT}\n\n${WEBSITE_SHARE_URL}`;

export const APP_SHARE_DATA = Object.freeze({
  title: 'QuestNote',
  text: APP_SHARE_TEXT,
  url: WEBSITE_SHARE_URL,
});

export async function shareQuestNote(navigatorLike = globalThis.navigator) {
  if (typeof navigatorLike?.share !== 'function') return 'unsupported';
  try {
    await navigatorLike.share(APP_SHARE_DATA);
    return 'shared';
  } catch (error) {
    return error?.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}

export async function copyQuestNoteInvitation(navigatorLike = globalThis.navigator, documentLike = globalThis.document) {
  try {
    if (typeof navigatorLike?.clipboard?.writeText === 'function') {
      await navigatorLike.clipboard.writeText(APP_SHARE_MESSAGE);
      return true;
    }
  } catch {
    // Older browsers and restricted contexts may need the selection fallback.
  }

  if (!documentLike?.body || typeof documentLike.execCommand !== 'function') return false;
  const previousFocus = documentLike.activeElement;
  const field = documentLike.createElement('textarea');
  field.value = APP_SHARE_MESSAGE;
  field.setAttribute('readonly', '');
  field.setAttribute('aria-hidden', 'true');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  documentLike.body.appendChild(field);
  field.select();
  try {
    return documentLike.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
    previousFocus?.focus?.();
  }
}
