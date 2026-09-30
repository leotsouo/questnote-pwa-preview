/** Formal UI icons only. User-authored tasks, names, lore and dialogue stay intact. */
import { questIcon } from './questIcons.js';
const SYMBOLS = Object.freeze({
  '✦': 'spark', '✨': 'spark', '🌟': 'star', '⭐': 'star', '⚡': 'energy', '✓': 'check',
  '✅': 'success', '❌': 'error', '⚠️': 'warning', '🎁': 'gift', '🏅': 'award', '🏆': 'award',
  '📖': 'book', '📘': 'book', '📚': 'book', '📝': 'edit', '📋': 'scroll', '📮': 'mail', '✉️': 'mail',
  '🗺️': 'map', '🧭': 'compass', '🌸': 'flower', '🌱': 'sprout', '🌿': 'leaf', '🔥': 'fire',
  '🛠️': 'workshop', '🔨': 'workshop', '⚙️': 'settings', '🎨': 'palette', '🔗': 'share', '💬': 'feedback',
  '💖': 'heart', '💕': 'heart', '❤️': 'heart', '💗': 'heart', '♡': 'heart', '🔒': 'lock', '🔓': 'lock',
  '⏳': 'clock', '⏱️': 'clock', '🕒': 'clock', '📅': 'calendar', '🔍': 'eye', '👁️': 'eye',
  '🐾': 'trail', '🐺': 'trail', '⛺': 'mountain', '🏕️': 'mountain', '🔊': 'sound', '💎': 'spark',
});
const symbols = new RegExp(Object.keys(SYMBOLS).map((symbol) => symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + '|\\p{Extended_Pictographic}(?:\\uFE0F|\\p{Emoji_Modifier})?(?:\\u200D\\p{Extended_Pictographic}(?:\\uFE0F|\\p{Emoji_Modifier})?)*', 'gu');
const excluded = 'script,style,textarea,input,option,svg,.qn-icon,.nav-icon,.twilight-wordmark,.twilight-greeting,.twilight-progress,.task-card__title,.task-card__meta,.task-card__preview,.subtask-text,.habit-card__name,.habit-card__desc,.companion-bubble,.companion-card__name,.twilight-voice,.pet-detail__name,.pet-detail__title,.pet-detail__lore,.pet-detail__desc,.pet-detail__summon-line,.bond-story,.bond-unlock-toast__text,.pet-original-name,.nickname-modal__original,.nickname-modal__current,.pet-image-viewer__title,.collection-card__name,.collection-card__title,.collection-companion__name,.companion-image-preview__name,.twilight-pet-name,.expedition-pet-option__name,.expedition-active-card__pet-name,.expedition-dispatch-modal__preview,.confirm-modal__text,.mailbox-detail__body,.feedback-card';
let installed = false;
export function initQuestIconLanguage() {
  if (installed) return;
  installed = true;
  const replace = (root) => {
    if (!root?.isConnected || root.nodeType !== 1 || root.closest(excluded)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (node.parentElement?.closest(excluded)) continue;
      const text = node.textContent;
      symbols.lastIndex = 0;
      if (!symbols.test(text)) continue;
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      symbols.lastIndex = 0;
      for (const match of text.matchAll(symbols)) {
        fragment.append(document.createTextNode(text.slice(cursor, match.index)));
        const holder = document.createElement('span');
        holder.innerHTML = questIcon(SYMBOLS[match[0]] || 'spark');
        const icon = holder.firstElementChild;
        icon.classList.add('qn-inline-icon');
        fragment.append(icon);
        cursor = match.index + match[0].length;
      }
      fragment.append(document.createTextNode(text.slice(cursor)));
      node.replaceWith(fragment);
    }
  };
  replace(document.body);
  const pending = new Set();
  let scheduled = false;
  new MutationObserver((changes) => {
    for (const change of changes) {
      if (change.type === 'characterData') pending.add(change.target.parentElement);
      for (const node of change.addedNodes) pending.add(node.nodeType === 1 ? node : node.parentElement);
    }
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; for (const node of pending) replace(node); pending.clear(); });
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
