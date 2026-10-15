/**
 * Workshop view: materials, crafting and the gift tab (workshopGiftView builds its markup).
 * Crafting and gifting are persisted by workshopService.
 */
import { recordOnboardingEvent } from '../onboardingController.js';
import { getTodayDateString } from '../taskFilterService.js';
import { twilightIcon } from '../twilightPresentation.js';
import { emptyStateHtml, escapeHtml } from '../uiHelpers.js';
import { buildWorkshopGiftView } from '../workshopGiftView.js';
import {
  getEnabledCraftables,
  getMaterialInventory,
  getItemInventory,
  getFutureTagLabels,
  getMaterialSourceLabel,
  getCraftingPreview,
  formatItemEffect,
  getGiftThemeLabel,
  getFavoriteBonus,
  getMaterialInfo,
  craftItem,
  useBondItem,
} from '../workshopService.js';
import { handleAchievementCheckAfterAction } from './achievementsView.js';

// Bound from src/ui.js by connectWorkshopView() so this module never imports ui.js back.
let notifyBondUnlocks, onRefresh, petDisplayName, petImageHtml, showToast, state, switchView, trackQuest;

export function connectWorkshopView(deps) {
  ({ notifyBondUnlocks, onRefresh, petDisplayName, petImageHtml, showToast, state, switchView, trackQuest } = deps);
}

let workshopTab = 'materials';
let selectedGiftPetId = null;
let selectedGiftItemId = null;
let workshopGiftMessage = '';
let workshopGiftBusy = false;
export function handleWorkshopTabClick(e) {
  const btn = e.target.closest('[data-workshop-tab]');
  if (!btn) return;
  if (workshopGiftBusy) return;
  if (btn.dataset.workshopTab === 'gift' && workshopTab !== 'gift') {
    selectedGiftItemId = null;
    selectedGiftPetId = null;
    workshopGiftMessage = '';
  }
  workshopTab = btn.dataset.workshopTab;
  document.querySelectorAll('#workshop-tabs .segmented-control__btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.workshopTab === workshopTab);
    b.setAttribute('aria-selected', b.dataset.workshopTab === workshopTab ? 'true' : 'false');
  });
  renderWorkshopView();
}

export function setWorkshopTab(tab) {
  workshopTab = tab;
}

/** Forget the chosen gift pet and item; keepMessage leaves the last gift message visible. */
export function clearWorkshopGiftSelection({ keepMessage = false } = {}) {
  selectedGiftItemId = null;
  selectedGiftPetId = null;
  if (!keepMessage) workshopGiftMessage = '';
}

export function renderWorkshopView() {
  if (!state) return;

  const summaryEl = document.getElementById('workshop-summary');
  const contentEl = document.getElementById('workshop-content');
  if (!summaryEl || !contentEl) return;

  const wallet = state.wallet || {};
  const inventory = state.inventory || { items: {}, itemUsageLogs: {} };
  const materialsCatalog = state.materialsCatalog || [];
  const craftables = state.craftablesCatalog || getEnabledCraftables();
  const materialCounts = getMaterialInventory(wallet);
  const itemCounts = getItemInventory(inventory);

  const knownMaterialIds = new Set(materialsCatalog.map((m) => m.id));
  const extraMaterialIds = Object.keys(materialCounts).filter((id) => !knownMaterialIds.has(id));
  const allMaterialEntries = [
    ...materialsCatalog.map((m) => ({ ...m, amount: materialCounts[m.id] || 0 })),
    ...extraMaterialIds.map((id) => ({
      ...getMaterialInfo(id),
      amount: materialCounts[id] || 0,
    })),
  ];

  const totalMaterials = allMaterialEntries.reduce((sum, m) => sum + (m.amount || 0), 0);
  const bondItems = craftables.filter(
    (c) => c.type === 'bond_item' || c.type === 'favorite_bond_item'
  );
  const totalItems = bondItems.reduce((sum, c) => sum + (itemCounts[c.id] || 0), 0);

  summaryEl.innerHTML = `
    <div class="workshop-summary__grid">
      <div class="workshop-summary__stat">
        <span class="workshop-summary__label">材料總數</span>
        <span class="workshop-summary__value">${totalMaterials}</span>
      </div>
      <div class="workshop-summary__stat">
        <span class="workshop-summary__label">道具庫存</span>
        <span class="workshop-summary__value">${totalItems}</span>
      </div>
    </div>`;

  if (workshopTab === 'materials') {
    if (allMaterialEntries.length === 0) {
      contentEl.innerHTML = emptyStateHtml(
        twilightIcon('workshop'),
        '目前還沒有材料',
        '派遣寵物探險，可以帶回製作禮物的材料。'
      );
      return;
    }

    contentEl.innerHTML = `
      <div class="workshop-material-list">
        ${allMaterialEntries
          .map((mat) => {
            const tags = getFutureTagLabels(mat.futureTags || []).slice(0, 3);
            const empty = (mat.amount || 0) === 0;
            return `
              <article class="workshop-material-card card ${empty ? 'workshop-material-card--empty' : ''}">
                <div class="workshop-material-card__header">
                  <h3>${escapeHtml(mat.name)}</h3>
                  <span class="rarity-badge rarity-badge--${(mat.rarity || 'n').toLowerCase()}">${escapeHtml(mat.rarity || '?')}</span>
                </div>
                <p class="workshop-material-card__qty">數量：<strong>${mat.amount || 0}</strong></p>
                <p class="workshop-material-card__desc">${escapeHtml(mat.description || '')}</p>
                ${getMaterialSourceLabel(mat, state.expeditionAreas) ? `<p class="workshop-material-card__source">來源：${escapeHtml(getMaterialSourceLabel(mat, state.expeditionAreas))}</p>` : ''}
                ${tags.length ? `<div class="workshop-tag-row">${tags.map((t) => `<span class="workshop-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
              </article>`;
          })
          .join('')}
      </div>`;
    return;
  }

  if (workshopTab === 'craft') {
    const enabled = craftables.filter((c) => c.enabled);
    if (enabled.length === 0) {
      contentEl.innerHTML = emptyStateHtml(
        twilightIcon('workshop'),
        '目前沒有可製作的道具',
        '等取得更多材料後再回來看看。'
      );
      return;
    }

    contentEl.innerHTML = `
      <div class="workshop-craft-list">
        ${enabled
          .map((craftable) => {
            const preview = getCraftingPreview(craftable.id, 1, wallet);
            const maxQty = preview.maxQuantity;
            const enough = preview.canCraft;
            return `
              <article class="workshop-craft-card card ${enough ? '' : 'workshop-craft-card--disabled'}">
                <div class="workshop-craft-card__header">
                  <h3>${escapeHtml(craftable.name)}</h3>
                  <span class="rarity-badge rarity-badge--${(craftable.rarity || 'n').toLowerCase()}">${escapeHtml(craftable.rarity || '?')}</span>
                </div>
                <p class="workshop-craft-card__effect">${escapeHtml(formatItemEffect(craftable))}</p>
                <p class="workshop-craft-card__theme">主題：${escapeHtml(getGiftThemeLabel(craftable))}</p>
                <p class="workshop-craft-card__desc">${escapeHtml(craftable.description || '')}</p>
                <p class="workshop-craft-card__affinity">${craftable.type === 'favorite_bond_item' ? '已擁有 ' + (state.enrichedCollection || []).filter((pet) => pet.owned && getFavoriteBonus(craftable, pet).isFavorite).length + ' 位喜歡它的夥伴' : '通用禮物，所有夥伴效果相同'}</p>
                <p class="workshop-craft-card__source">材料來源：${escapeHtml([...new Set(Object.keys(craftable.recipe || {}).map((id) => getMaterialSourceLabel(getMaterialInfo(id), state.expeditionAreas)).filter(Boolean))].join('、'))}</p>
                <ul class="workshop-recipe-list">
                  ${preview.materials
                    .map(
                      (m) =>
                        `<li class="${m.enough ? '' : 'workshop-recipe-list__item--missing'}">${escapeHtml(m.name)} <span>${m.have} / ${m.need}</span></li>`
                    )
                    .join('')}
                </ul>
                <div class="workshop-craft-card__actions">
                  <button class="btn btn--primary btn--sm" data-action="craft-item" data-item-id="${craftable.id}" data-qty="1" ${enough ? '' : 'disabled'}>製作 x1</button>
                  ${maxQty >= 5 ? `<button class="btn btn--secondary btn--sm" data-action="craft-item" data-item-id="${craftable.id}" data-qty="5" ${maxQty >= 5 ? '' : 'disabled'}>x5</button>` : ''}
                  ${maxQty > 1 ? `<button class="btn btn--secondary btn--sm" data-action="craft-item" data-item-id="${craftable.id}" data-qty="${maxQty}" ${enough ? '' : 'disabled'}>最大 (${maxQty})</button>` : ''}
                </div>
              </article>`;
          })
          .join('')}
      </div>`;
    return;
  }

  const model = buildWorkshopGiftView({
    items: bondItems,
    pets: state.enrichedCollection || [],
    inventory,
    date: getTodayDateString(),
    itemId: selectedGiftItemId,
    petId: selectedGiftPetId,
    message: workshopGiftMessage,
    busy: workshopGiftBusy,
    imageHtml: (pet) => petImageHtml(pet, { size: 'sm' }),
    displayName: petDisplayName,
  });
  selectedGiftItemId = model.itemId;
  selectedGiftPetId = model.petId;
  contentEl.innerHTML = model.html;
}

export async function handleWorkshopClick(e) {
  const backBtn = e.target.closest('[data-goto]');
  if (backBtn) {
    switchView(backBtn.dataset.goto);
    return;
  }

  const target = e.target.closest('[data-action]');
  if (!target || !state) return;

  const action = target.dataset.action;
  if (target.disabled || workshopGiftBusy) return;

  if (action === 'select-gift-pet') {
    selectedGiftPetId = target.dataset.petId;
    renderWorkshopView();
    document.querySelector(`.workshop-gift-pet[data-pet-id="${selectedGiftPetId}"]`)?.focus({ preventScroll: true });
    return;
  }

  if (action === 'select-gift-item') {
    if (selectedGiftItemId !== target.dataset.itemId) selectedGiftPetId = null;
    selectedGiftItemId = target.dataset.itemId;
    renderWorkshopView();
    document.querySelector(`.workshop-gift-item[data-item-id="${selectedGiftItemId}"]`)?.focus({ preventScroll: true });
    return;
  }

  if (action === 'craft-item') {
    const itemId = target.dataset.itemId;
    const qty = parseInt(target.dataset.qty, 10) || 1;
    if (target.disabled) {
      showToast('材料不足，無法製作。', 'warning');
      return;
    }
    try {
      const result = await craftItem(itemId, qty);
      if (!result.success) {
        showToast(result.message, 'warning');
        return;
      }
      void recordOnboardingEvent('item-crafted', { itemId });
      await trackQuest('craft');
      await onRefresh({ renderMode: ['workshop', 'tasks'] });
      renderWorkshopView();
      showToast(result.message, 'success');
      const card = target.closest('.workshop-craft-card');
      if (card && !state.userPreferences?.reduceMotion) {
        card.classList.add('workshop-craft-card--success');
        setTimeout(() => card.classList.remove('workshop-craft-card--success'), 800);
      }
      await handleAchievementCheckAfterAction();
    } catch (err) {
      showToast(err.message || '製作失敗', 'error');
    }
    return;
  }

  if (action === 'gift-item') {
    const itemId = target.dataset.itemId;
    const petId = target.dataset.petId;
    if (target.disabled || workshopGiftBusy) return;
    workshopGiftBusy = true;
    renderWorkshopView();
    try {
      const result = await useBondItem(itemId, petId, state.allPets);
      if (!result.success) {
        showToast(result.message, 'warning');
        return;
      }
      workshopGiftMessage = result.message;
      void recordOnboardingEvent('gift-given', { petId, itemId });
      await trackQuest('gift_pet');
      await onRefresh({ renderMode: ['workshop', 'tasks', 'collection'] });
      renderWorkshopView();
      if (result.isFavorite) {
        showToast(`牠很喜歡這份禮物！親密度 +${result.bondExp}`, 'success', 3200);
      } else {
        showToast(`親密度提升 +${result.bondExp}`, 'success');
      }
      if (result.leveledUp) {
        setTimeout(() => showToast(`親密度提升到 Lv.${result.newLevel}`, 'success', 2800), 400);
        await notifyBondUnlocks(petId);
      }
      const petCard = document.querySelector(`.workshop-gift-pet[data-pet-id="${petId}"]`);
      if (petCard && !state.userPreferences?.reduceMotion) {
        petCard.classList.add('workshop-gift-pet--bounce');
        setTimeout(() => petCard.classList.remove('workshop-gift-pet--bounce'), 600);
      }
      await handleAchievementCheckAfterAction();
    } catch (err) {
      showToast(err.message || '贈送失敗', 'error');
    } finally {
      workshopGiftBusy = false;
      renderWorkshopView();
    }
  }
}
