const escape = (text) => String(text ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const asset = (image) => new URL('../' + image, import.meta.url).href;

// Read-only artwork selection. Older mountain partners use their canonical art
// as the awakened form; newer pairs declare both images in the awakening catalog.
export function poolAwakeningArtwork(pet, catalog) {
  const entry = catalog?.pets?.find((row) => row.petId === pet?.id);
  if (!entry?.initialImage?.original) return null;
  return {
    initial: entry.initialImage,
    awakened: entry.awakenedImage || { original: pet.image, ...pet.imageVariants },
  };
}

export function renderPoolAwakeningPreview(pet, catalog) {
  const pair = poolAwakeningArtwork(pet, catalog);
  if (!pair) return '';
  return `<section class="pool-form-preview" data-pool-form-preview>
    <button type="button" class="pool-form-preview__button" aria-label="${escape(pet.name)}，翻面預覽覺醒造型" aria-pressed="false">
      <span class="pool-form-preview__card">
        <span class="pool-form-preview__face" data-preview-face="initial" aria-hidden="false"><img src="${escape(asset(pair.initial.stage || pair.initial.original))}" data-fallback="${escape(asset(pair.initial.original))}" alt="${escape(pet.name)} · 初遇相" decoding="async"></span>
        <span class="pool-form-preview__face pool-form-preview__face--back" data-preview-face="awakened" aria-hidden="true"><img data-preview-src="${escape(asset(pair.awakened.stage || pair.awakened.original))}" data-preview-fallback="${escape(asset(pair.awakened.original))}" alt="${escape(pet.name)} · 覺醒相預覽" decoding="async"></span>
      </span>
      <span class="pool-form-preview__hint">↻ 翻面看覺醒</span>
    </button>
    <p class="pool-form-preview__status" role="status" aria-live="polite">初遇相 · 點擊卡片預覽覺醒造型</p>
    <p class="subtle">造型預覽 · 召喚時以初遇相相遇；完成羈絆覺醒後，可使用雙形態與專屬演出。</p>
  </section>`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(src);
    image.onerror = () => reject(new Error('覺醒造型載入失敗'));
    image.src = src;
  });
}

export function bindPoolAwakeningPreview(host, { reduceMotion = () => false } = {}) {
  if (!host) return;
  const button = host.querySelector('button');
  const backImage = host.querySelector('[data-preview-src]');
  const hint = host.querySelector('.pool-form-preview__hint');
  const status = host.querySelector('[role="status"]');
  let loaded = false;
  button.addEventListener('click', async (event) => {
    if (button.disabled) return;
    const instant = event.detail === 0 || reduceMotion();
    if (!loaded) {
      const hadFocus = document.activeElement === button;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      hint.textContent = '載入覺醒造型…';
      try {
        const src = await loadImage(backImage.dataset.previewSrc).catch((error) => {
          if (backImage.dataset.previewFallback === backImage.dataset.previewSrc) throw error;
          return loadImage(backImage.dataset.previewFallback);
        });
        backImage.src = src;
        await backImage.decode();
        loaded = true;
      } catch {
        hint.textContent = '↻ 重試覺醒預覽';
        status.textContent = '覺醒造型暫時無法載入，仍顯示初遇相。點擊卡片重試。';
        return;
      } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        if (hadFocus && host.isConnected && [document.body, button].includes(document.activeElement)) button.focus({ preventScroll: true });
      }
    }
    if (!host.isConnected) return;
    host.classList.toggle('is-instant', instant);
    const awakened = button.getAttribute('aria-pressed') !== 'true';
    host.classList.toggle('is-awakened', awakened);
    button.setAttribute('aria-pressed', String(awakened));
    // Keep the toggle's accessible name stable; aria-pressed reports its state.
    host.querySelector('[data-preview-face="initial"]').setAttribute('aria-hidden', String(awakened));
    host.querySelector('[data-preview-face="awakened"]').setAttribute('aria-hidden', String(!awakened));
    hint.textContent = awakened ? '↻ 翻回初遇' : '↻ 翻面看覺醒';
    status.textContent = awakened ? '覺醒相 · 造型預覽' : '初遇相 · 點擊卡片預覽覺醒造型';
  });
}
