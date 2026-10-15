/**
 * Shared modal host: the #modal-overlay dialog, confirm dialogs, the full-size pet image
 * viewer and pet image markup. Focus is remembered and restored through dialogFocus.
 */
import { closeDailyRace } from '../dailyRaceController.js';
import {
  bindDialogFocus,
  isTopDialog,
  rememberDialogFocus,
  focusDialog,
  restoreDialogFocus,
} from '../dialogFocus.js';
import { getPetImageSrc, preloadImage } from '../imagePreloadService.js';
import {
  isSeniorMode,
  decorateSeniorControls,
  seniorTaskFormClosed,
  syncSeniorPresentation,
} from '../seniorModeController.js';
import { escapeHtml } from '../uiHelpers.js';
import { trackUpdateActivity } from '../updateActivity.js';
import { resolveGachaResultWait } from './gachaView.js';

// Bound from src/ui.js by connectModalHost() so this module never imports ui.js back.
let petDisplayName, petOriginalName, showToast, state;

export function connectModalHost(deps) {
  ({ petDisplayName, petOriginalName, showToast, state } = deps);
}

export function bindModals() {
  bindDialogFocus();
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') dismissModal();
  });
  document.getElementById('modal-close')?.addEventListener('click', dismissModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isTopDialog(document.getElementById('modal-overlay'))) {
      e.preventDefault();
      e.stopImmediatePropagation();
      dismissModal();
    }
  });
}

export function dismissModal() {
  const overlay = document.getElementById('modal-overlay');
  if (!isTopDialog(overlay)) return;
  if (overlay.querySelector('#task-form[data-saving="true"], #habit-form[data-saving="true"]')) return;
  const form = overlay.querySelector('#task-form[data-dirty="true"]');
  if (isSeniorMode() && form) {
    if (form.querySelector('.senior-discard')) return;
    const warning = document.createElement('section');
    warning.className = 'senior-discard card';
    warning.setAttribute('role', 'alert');
    warning.innerHTML = '<h3>尚未儲存這次修改</h3><p>要繼續編輯，還是放棄這次修改？</p><div class="form-actions"><button type="button" class="btn btn--primary" data-keep-editing>繼續編輯</button><button type="button" class="btn btn--danger" data-discard-edit>放棄修改</button></div>';
    form.prepend(warning);
    warning.querySelector('[data-keep-editing]').addEventListener('click', () => { warning.remove(); form.querySelector('textarea').focus(); });
    warning.querySelector('[data-discard-edit]').addEventListener('click', closeModal);
    warning.querySelector('button').focus();
    return;
  }
  // Cancel retains the existing restore-preview callback and DOM.
  const cancel = overlay.querySelector('#confirm-cancel');
  if (cancel) cancel.click();
  else closeModal();
}

export function openModal(contentHtml) {
  closeDailyRace();
  const overlay = document.getElementById('modal-overlay');
  const body = document.getElementById('modal-body');
  if (!overlay?.classList.contains('open')) rememberDialogFocus(overlay);
  if (body) body.innerHTML = contentHtml;
  overlay?.classList.add('open');
  document.body.classList.add('modal-open');
  if (body) body.scrollTop = 0;
  decorateSeniorControls();
  focusDialog(overlay);
}

export function closeModal() {
  closeDailyRace();
  const overlay = document.getElementById('modal-overlay');
  const wasOpen = overlay?.classList.contains('open');
  overlay?.classList.remove('open');
  if (!document.getElementById('global-mailbox-modal')?.classList.contains('open')) {
    document.body.classList.remove('modal-open');
  }
  if (wasOpen) restoreDialogFocus(overlay);
  seniorTaskFormClosed();
  syncSeniorPresentation();
  if (typeof resolveGachaResultWait === 'function') {
    resolveGachaResultWait();
  }
}

/* ─── V2.6.1 寵物原圖放大檢視器（獨立 overlay，可疊在其他 modal 之上） ─── */

let petImageViewerLastFocus = null;

/**
 * 依 petId 開啟寵物原圖檢視器（自 enrichedCollection / allPets / companion 取資料）。
 * 僅對已獲得且有圖片的寵物開啟。
 * @param {string} petId
 * @param {HTMLElement} [opener] 實際觸發按鈕，供關閉後返回焦點。
 */
export function openPetImageViewer(petId, opener) {
  if (!petId) return;
  const pet =
    (state.enrichedCollection || []).find((p) => p.id === petId) ||
    (state.companion?.id === petId ? state.companion : null) ||
    (state.allPets || []).find((p) => p.id === petId);
  if (!pet) return;
  if (pet.owned === false) {
    showToast('尚未獲得此寵物', 'info');
    return;
  }
  const src = getPetImageSrc(pet);
  if (!src) {
    showToast('這隻寵物沒有可顯示的原圖', 'info');
    return;
  }
  const original = pet.nickname ? petOriginalName(pet) : '';
  openPetImageViewerBySrc(src, petDisplayName(pet), pet.rarity, original, opener, getPetImageSrc(pet, 'stage'), pet.fallbackImage || '');
}

/**
 * 直接以圖片來源開啟寵物原圖檢視器。
 * @param {string} imageSrc 圖片來源
 * @param {string} petName 主名稱（有暱稱時顯示暱稱）
 * @param {string} rarity 稀有度
 * @param {string} [originalName] 副名稱（原名，僅有暱稱時顯示）
 * @param {HTMLElement} [opener] 未指定時沿用目前焦點。
 */
export function openPetImageViewerBySrc(imageSrc, petName, rarity, originalName = '', opener, previewSrc = '', fallbackSrc = '') {
  const resolved = getPetImageSrc({ image: imageSrc }) || imageSrc;
  if (!resolved) return;

  // 確保單一實例，先清掉任何殘留的檢視器
  closePetImageViewer();
  petImageViewerLastFocus = opener || document.activeElement;

  const rarityClass = rarity ? `rarity-${rarity}` : '';
  const safeName = escapeHtml(petName || '寵物原圖');
  const overlay = document.createElement('div');
  overlay.className = 'pet-image-viewer';
  overlay.id = 'pet-image-viewer';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `${petName || '寵物'} 原圖`);
  overlay.innerHTML = `
    <div class="pet-image-viewer__backdrop" data-viewer-close></div>
    <div class="pet-image-viewer__content ${rarityClass}">
      <button class="pet-image-viewer__close" type="button" aria-label="關閉原圖檢視" data-viewer-close>×</button>
      <div class="pet-image-viewer__header">
        <div class="pet-image-viewer__title">${safeName}</div>
        ${originalName ? `<div class="pet-image-viewer__subtitle">原名：${escapeHtml(originalName)}</div>` : ''}
        ${rarity ? `<div class="pet-image-viewer__meta">${escapeHtml(rarity)}</div>` : ''}
      </div>
      <div class="pet-image-viewer__image-frame is-loading">
        <div class="pet-image-viewer__loading" aria-hidden="true">圖片載入中…</div>
        <div class="pet-image-viewer__error" role="alert">圖片暫時無法載入</div>
        <img
          class="pet-image-viewer__image"
          alt="${safeName}"
          decoding="async"
        />
        <div class="pet-image-viewer__preview-note" role="status" aria-live="polite"></div>
      </div>
      <div class="pet-image-viewer__hint">點擊背景或按關閉返回</div>
    </div>`;

  // 只有背景與關閉鈕會關閉；點圖片本身不關閉，避免誤觸
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('[data-viewer-close]')) {
      closePetImageViewer();
    }
  });

  const frame = overlay.querySelector('.pet-image-viewer__image-frame');
  const image = overlay.querySelector('.pet-image-viewer__image');
  const note = overlay.querySelector('.pet-image-viewer__preview-note');
  const preview = previewSrc && previewSrc !== resolved ? previewSrc : resolved;
  let originalStarted = false;
  let fallbackUsed = false;
  const loadOriginal = () => {
    if (originalStarted || preview === resolved) return;
    originalStarted = true;
    void preloadImage(resolved, { eager: true }).then(({ ok }) => {
      if (!overlay.isConnected) return;
      if (ok) image.src = resolved;
      else note.textContent = '原圖暫時無法載入，仍可查看預覽圖';
    });
  };
  image.onload = () => {
    frame.classList.remove('is-loading', 'is-error');
    frame.classList.add('is-loaded');
    if (image.src === new URL(resolved, location.href).href) note.textContent = '';
    else if (!fallbackUsed) loadOriginal();
  };
  image.onerror = () => {
    if (fallbackUsed) {
      frame.classList.remove('is-loading', 'is-loaded');
      frame.classList.add('is-error');
      return;
    }
    if (image.src !== new URL(resolved, location.href).href) {
      image.src = resolved;
      return;
    }
    if (fallbackSrc && image.src !== new URL(fallbackSrc, location.href).href) {
      fallbackUsed = true;
      image.src = fallbackSrc;
      note.textContent = '形態圖片暫時無法載入，顯示現行卡圖；形態選擇已保留';
      return;
    }
    frame.classList.remove('is-loading', 'is-loaded');
    frame.classList.add('is-error');
  };
  image.src = preview;
  if (preview !== resolved) {
    note.textContent = '顯示預覽圖，原圖載入中…';
  }

  document.body.appendChild(overlay);
  document.body.classList.add('is-pet-image-viewer-open');
  // 用 capture 攔截 Escape，確保只關閉 viewer 而不會連帶關掉底層 modal
  document.addEventListener('keydown', handlePetImageViewerKeydown, true);

  requestAnimationFrame(() => {
    overlay.classList.add('is-open');
    overlay.querySelector('.pet-image-viewer__close')?.focus();
  });
}

function handlePetImageViewerKeydown(e) {
  if (e.key !== 'Escape') return;
  if (!isTopDialog(document.getElementById('pet-image-viewer'))) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  closePetImageViewer();
}

/** 關閉寵物原圖檢視器並清理 DOM / body class / 事件 / 焦點 */
export function closePetImageViewer() {
  document.removeEventListener('keydown', handlePetImageViewerKeydown, true);
  const overlay = document.getElementById('pet-image-viewer');
  if (overlay) rememberDialogFocus(overlay, petImageViewerLastFocus);
  if (overlay) overlay.remove();
  document.body.classList.remove('is-pet-image-viewer-open');
  if (petImageViewerLastFocus?.isConnected && typeof petImageViewerLastFocus.focus === 'function') {
    try {
      petImageViewerLastFocus.focus({ preventScroll: true });
    } catch {
      /* 元素可能已不存在 */
    }
  }
  if (overlay) restoreDialogFocus(overlay);
  petImageViewerLastFocus = null;
}

/** 確認彈窗 */
export function openConfirmModal(title, message, onConfirm, options = {}) {
  const { confirmLabel = '確定', danger = false, onCancel = null } = options;
  openModal(`
    <div class="confirm-modal${danger ? ' confirm-modal--danger' : ''}">
      <div class="confirm-modal__icon">${danger ? '⚠️' : '❓'}</div>
      <h2 class="modal-title">${escapeHtml(title)}</h2>
      <p class="confirm-modal__text">${escapeHtml(message)}</p>
      <div class="confirm-modal__actions">
        <button class="btn btn--ghost" id="confirm-cancel">取消</button>
        <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" id="confirm-ok">${escapeHtml(confirmLabel)}</button>
      </div>
    </div>
  `);

  document.getElementById('confirm-cancel')?.addEventListener('click', () => {
    closeModal();
    if (typeof onCancel === 'function') onCancel();
  });
  document.getElementById('confirm-ok')?.addEventListener('click', trackUpdateActivity(async () => {
    closeModal();
    try { await onConfirm(); }
    catch (error) { showToast(error.message || '操作未完成，請再試一次。', 'error'); }
  }));
}

/** 寵物圖片含 fallback；preview 模式顯示模糊黑白預覽（未獲得） */
export function petImageHtml(pet, options = {}) {
  const {
    size = 'md',
    preview = false,
    loading = 'lazy',
    eager = false,
    framed = true,
    imageVariant = size === 'lg' ? 'stage' : 'card',
  } = options;
  const cls = `pet-img pet-img--${size}`;
  const src = getPetImageSrc(pet, imageVariant);
  const originalSrc = pet.fallbackImage || getPetImageSrc(pet);
  const loadAttr = eager || loading === 'eager' ? 'eager' : loading;
  const onload = "this.classList.add('is-loaded');this.closest('.pet-image-frame')?.classList.remove('is-loading')";
  const onerror = "if(this.dataset.originalSrc&&this.src!==new globalThis.URL(this.dataset.originalSrc,location.href).href){this.src=this.dataset.originalSrc;return;}this.onerror=null;this.classList.add('is-error');var f=this.closest('.pet-image-frame');if(f){f.classList.remove('is-loading');f.classList.add('is-error');var label=f.querySelector('.pet-image-frame__fallback');if(label)label.textContent='?';}";
  const fallbackAttr = originalSrc ? ` data-original-src="${escapeHtml(originalSrc)}"` : '';
  const placeholder = framed
    ? `<div class="pet-image-frame pet-image-frame--${size} is-error" role="img" aria-label="圖片暫時無法載入"><span class="pet-image-frame__fallback" aria-hidden="true">?</span></div>`
    : `<div class="${cls} pet-img--placeholder"><span>?</span></div>`;

  if (!src) return placeholder;

  if (preview) {
    return `<div class="pet-img-wrap pet-img-wrap--preview pet-img-wrap--${size} pet-image-frame pet-image-frame--${size} is-loading">
      <img class="${cls} pet-img--preview is-loading" src="${escapeHtml(src)}"${fallbackAttr} alt="" loading="${loadAttr}" decoding="async" onload="${onload}" onerror="${onerror}" />
      <span class="pet-image-frame__fallback" aria-hidden="true">圖片載入中</span>
    </div>`;
  }

  if (!framed) {
    const onErrorLegacy = `if(this.dataset.originalSrc&&this.src!==new globalThis.URL(this.dataset.originalSrc,location.href).href){this.src=this.dataset.originalSrc;return;}this.onerror=null;this.replaceWith(Object.assign(document.createElement('div'),{className:'${cls} pet-img--placeholder',innerHTML:'<span>?</span>'}))`;
    return `<img class="${cls} is-loading" src="${escapeHtml(src)}"${fallbackAttr} alt="${escapeHtml(petDisplayName(pet))}" loading="${loadAttr}" decoding="async" onload="this.classList.add('is-loaded')" onerror="${onErrorLegacy}" />`;
  }

  return `<div class="pet-image-frame pet-image-frame--${size} is-loading">
    <img class="${cls} is-loading" src="${escapeHtml(src)}"${fallbackAttr} alt="${escapeHtml(petDisplayName(pet))}" loading="${loadAttr}" decoding="async" onload="${onload}" onerror="${onerror}" />
    <span class="pet-image-frame__fallback" aria-hidden="true">圖片載入中</span>
  </div>`;
}
