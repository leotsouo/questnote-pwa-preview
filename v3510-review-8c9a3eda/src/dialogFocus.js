/** Focus utilities for existing dialog shells; no navigation or game-state ownership. */
const openers = new WeakMap();
const MANAGED_DIALOGS = '#modal-overlay, #pet-image-viewer, #global-mailbox-modal, #expedition-dispatch-modal';

function visible(element) {
  return element?.isConnected && element.getClientRects().length > 0
    && getComputedStyle(element).visibility !== 'hidden'
    && !element.closest('[inert], #modal-overlay:not(.open), #global-mailbox-modal:not(.open)');
}

function controls(root) {
  return [...root.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')]
    .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && visible(element));
}

function stackingLevel(element) {
  let level = 0;
  for (let current = element; current; current = current.parentElement) {
    level = Math.max(level, Number.parseInt(getComputedStyle(current).zIndex, 10) || 0);
  }
  return level;
}

function topDialog() {
  return [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')]
    .filter(visible).sort((a, b) => stackingLevel(a) - stackingLevel(b)).at(-1);
}

export function isTopDialog(root) {
  const top = topDialog();
  return !!root && !!top && (root === top || root.contains(top));
}

export function rememberDialogFocus(root, opener = document.activeElement) {
  if (root) openers.set(root, opener);
}

export function focusDialog(root) {
  requestAnimationFrame(async () => {
    if (!root) return;
    // Wait for the shell's visibility transition, not decorative child animations.
    // System reduced-motion shortens these transitions through the existing styles.
    const transitions = root.getAnimations().filter((animation) =>
      Number.isFinite(animation.effect?.getComputedTiming().endTime));
    await Promise.allSettled(transitions.map((animation) => animation.finished));
    // Visibility can settle before descendants accept focus (notably with
    // near-zero transitions). Verify focus after paint; never steal it back
    // from a user who has already moved into this or a higher dialog.
    for (let frame = 0; frame < 30 && root.isConnected; frame += 1) {
      if (root.matches('#modal-overlay:not(.open), #global-mailbox-modal:not(.open)')) return;
      if (visible(root)) {
        if (!isTopDialog(root) || root.contains(document.activeElement)) return;
        const heading = root.querySelector('h1, h2, [role="heading"]');
        const target = heading || controls(root)[0] || root;
        if (target.tabIndex < 0) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        if (root.contains(document.activeElement)) return;
      }
      await new Promise(requestAnimationFrame);
    }
  });
}

export function restoreDialogFocus(root) {
  const opener = openers.get(root);
  openers.delete(root);
  requestAnimationFrame(() => {
    // A synchronous replacement/next dialog owns focus now.
    if (visible(root)) return;
    const top = topDialog();
    if (top?.contains(document.activeElement)) return;
    if (visible(opener) && !opener.matches(':disabled') && (!top || top.contains(opener))) {
      opener.focus({ preventScroll: true });
    } else if (top) {
      focusDialog(top);
    } else {
      document.querySelector('.nav-item.active')?.focus({ preventScroll: true });
    }
  });
}

export function bindDialogFocus() {
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const top = topDialog();
    // Respect independent summon/reveal controllers above these shells.
    if (!top?.closest(MANAGED_DIALOGS)) return;
    const items = controls(top);
    const first = items[0];
    const last = items.at(-1);
    if (!first) {
      event.preventDefault();
      top.setAttribute('tabindex', '-1');
      top.focus();
    } else if (!items.includes(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, true);

  // Confirmations can replace body content without calling openModal.
  // Keep a stable accessible name instead of pointing at a removed heading ID.
  const overlay = document.getElementById('modal-overlay');
  const body = document.getElementById('modal-body');
  if (overlay && body) {
    const nameDialog = () => {
      overlay.setAttribute('aria-label', body.querySelector('h1, h2, [role="heading"]')?.textContent.trim() || 'QuestNote 視窗');
    };
    new MutationObserver(nameDialog).observe(body, { childList: true, subtree: true, characterData: true });
    nameDialog();
  }
}
