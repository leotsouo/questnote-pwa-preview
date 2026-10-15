/** Item-first workshop presentation. All affinity and ordering rules live in the service. */
import { escapeHtml } from './uiHelpers.js';
import { getBondLevelFromExp, getBondProgress } from './collectionService.js';
import { formatItemEffect, getGiftRecommendations, getGiftThemeLabel } from './workshopService.js';

export function buildWorkshopGiftView({ items, pets, inventory, date, itemId, petId,
  message = '', busy = false, imageHtml = () => '', displayName = (pet) => pet.nickname || pet.name }) {
  const availableItems = items.filter((item) => (inventory.items?.[item.id] || 0) > 0);
  const selectedItem = availableItems.find((item) => item.id === itemId);
  const groups = getGiftRecommendations(selectedItem, pets, inventory, date);
  const selected = selectedItem
    ? [...groups.recommended, ...groups.others].find((candidate) => candidate.pet.id === petId) : null;
  const status = message ? `<p class="workshop-gift-status" role="status">${escapeHtml(message)}</p>` : '';
  if (!pets.some((pet) => pet.owned)) {
    return { itemId: null, petId: null, html: `${status}<p>還沒有可以贈送的夥伴，先透過召喚獲得第一位夥伴。</p>` };
  }
  if (!availableItems.length) {
    return { itemId: null, petId: null, html: `${status}<p>目前沒有可贈送的道具，先到製作頁使用探險材料製作禮物。</p>` };
  }
  const petCard = (candidate) => {
    const { pet, bondExp, reason, bondLevel, dailyUsed, dailyLimit, atDailyLimit, atMaxLevel } = candidate;
    return `<button type="button" class="workshop-gift-pet ${selected?.pet.id === pet.id ? 'workshop-gift-pet--selected' : ''}"
      data-action="select-gift-pet" data-pet-id="${escapeHtml(pet.id)}" aria-pressed="${selected?.pet.id === pet.id}"
      ${atDailyLimit || busy ? 'disabled' : ''}>
      <div class="workshop-gift-pet__img">${imageHtml(pet)}</div>
      <div class="workshop-gift-pet__info">
        <span class="workshop-gift-pet__name">${escapeHtml(displayName(pet))}</span>
        ${pet.nickname ? `<span class="pet-original-name pet-original-name--xs">原名：${escapeHtml(pet.name)}</span>` : ''}
        <span class="workshop-gift-pet__reason">${escapeHtml(reason)} · 親密度 +${bondExp}</span>
        <span class="workshop-gift-pet__meta">Lv.${bondLevel} · 今日 ${dailyUsed}/${dailyLimit}</span>
        ${atDailyLimit ? '<span class="workshop-gift-pet__meta">今日已達收禮上限</span>' : ''}
        ${atMaxLevel ? '<span class="workshop-gift-pet__meta">已達最高等級，仍可收禮</span>' : ''}
        ${pet.isCompanion ? '<span class="workshop-gift-pet__companion">陪伴中</span>' : ''}
      </div>
    </button>`;
  };
  let preview = '';
  if (selected) {
    const exp = selected.pet.bondExp ?? 0;
    const progress = getBondProgress(exp, selected.bondLevel);
    const afterLevel = getBondLevelFromExp(exp + selected.bondExp);
    preview = `<section class="workshop-gift-preview card ${selected.isFavorite ? 'workshop-gift-preview--favorite' : ''}">
      <h2 class="section-title">3. 確認贈送</h2>
      <p>${escapeHtml(selectedItem.name)} → ${escapeHtml(displayName(selected.pet))}</p>
      <ul class="workshop-gift-preview__list">
        <li>消耗：1 份（庫存 ${inventory.items[selectedItem.id]} 份）</li>
        <li>目前親密度：Lv.${selected.bondLevel}（${progress.current}/${progress.max || 'MAX'}）</li>
        <li>使用後增加：+${selected.bondExp}${selected.isFavorite ? '（喜好總計）' : ''}</li>
        <li>${escapeHtml(selected.reason)}</li>
        <li>今日已使用：${selected.dailyUsed} / ${selected.dailyLimit}</li>
        ${afterLevel > selected.bondLevel ? `<li class="workshop-gift-preview__levelup">預計升級至 Lv.${afterLevel}</li>` : ''}
        ${selected.atMaxLevel ? '<li>已達最高等級，本次仍會消耗禮物。</li>' : ''}
      </ul>
      <button type="button" class="btn btn--primary btn--block" data-action="gift-item"
        data-item-id="${escapeHtml(selectedItem.id)}" data-pet-id="${escapeHtml(selected.pet.id)}"
        ${busy || selected.atDailyLimit ? 'disabled' : ''}>${busy ? '贈送中…' : '確認贈送 1 份'}</button>
      ${selected.atDailyLimit ? '<p class="workshop-gift-preview__limit">今日已達收禮上限，明天再來吧。</p>' : ''}
    </section>`;
  }
  return {
    itemId: selectedItem?.id || null,
    petId: selected?.pet.id || null,
    html: `${status}<div class="workshop-gift-layout" aria-busy="${busy}">
      <section class="workshop-gift-section card">
        <h2 class="section-title">1. 選擇禮物</h2>
        <div class="workshop-gift-item-list">${availableItems.map((item) => `
          <button type="button" class="workshop-gift-item ${selectedItem?.id === item.id ? 'workshop-gift-item--selected' : ''}"
            data-action="select-gift-item" data-item-id="${escapeHtml(item.id)}"
            aria-pressed="${selectedItem?.id === item.id}" ${busy ? 'disabled' : ''}>
            <span class="workshop-gift-item__name">${escapeHtml(item.name)} · ${escapeHtml(getGiftThemeLabel(item))}</span>
            <span class="workshop-gift-item__stock">×${inventory.items[item.id]}</span>
            <span class="workshop-gift-item__effect">${escapeHtml(formatItemEffect(item))}</span>
          </button>`).join('')}</div>
      </section>
      ${selectedItem ? `<section class="workshop-gift-section card">
        <h2 class="section-title">2. ${groups.themed ? '推薦夥伴' : '選擇夥伴'}</h2>
        ${groups.themed && !groups.recommended.length ? '<p>尚未擁有喜歡這份禮物的夥伴，也可以選擇其他夥伴，獲得基本效果。</p>' : ''}
        <div class="workshop-gift-pet-list">${groups.recommended.map(petCard).join('')}</div>
        ${groups.others.length ? `<details class="workshop-gift-others" ${selected && !selected.isFavorite ? 'open' : ''}>
          <summary>其他夥伴（${groups.others.length}）· 基本效果</summary>
          <div class="workshop-gift-pet-list">${groups.others.map(petCard).join('')}</div>
        </details>` : ''}
      </section>` : '<p class="workshop-gift-hint">先選一份禮物，就會顯示可以收禮的夥伴。</p>'}
      ${preview}
    </div>`,
  };
}
