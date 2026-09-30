export const APP_SHARE_URL = 'https://leotsouo.github.io/questnote-pwa/';

export const APP_SHARE_DATA = Object.freeze({
  title: 'QuestNote',
  text: '用 QuestNote 記錄任務、養成習慣，和幻獸一起冒險。',
  url: APP_SHARE_URL,
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

export async function copyQuestNoteUrl(navigatorLike = globalThis.navigator, documentLike = globalThis.document) {
  try {
    if (typeof navigatorLike?.clipboard?.writeText === 'function') {
      await navigatorLike.clipboard.writeText(APP_SHARE_URL);
      return true;
    }
  } catch {
    // Older browsers and restricted contexts may need the selection fallback.
  }

  if (!documentLike?.body || typeof documentLike.execCommand !== 'function') return false;
  const previousFocus = documentLike.activeElement;
  const field = documentLike.createElement('textarea');
  field.value = APP_SHARE_URL;
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
