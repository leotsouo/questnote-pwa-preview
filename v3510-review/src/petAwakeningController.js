import { startPetAwakening, pausePetAwakening, awakenPet, setAwakeningForm } from './petAwakeningService.js';
import { renderAwakeningReader } from './petAwakeningView.js';
import { playAwakeningScene } from './petAwakeningScene.js';
import { trackUpdateActivity } from './updateActivity.js';
export function createAwakeningController({ getState, refresh, openModal, closeModal, showToast, switchView, portrait }) {
  let petId = null;
  let busy = false;
  const pet = () => getState().enrichedCollection?.find((p) => p.id === petId && p.owned);
  const render = () => { if (pet() && document.getElementById('modal-overlay')?.classList.contains('open')) openModal(renderAwakeningReader(pet(), getState(), portrait(pet()))); };
  async function open(id) {
    if (busy) return;
    petId = id;
    openModal('<section class="awakening-reader"><h2>羈絆覺醒</h2><p>正在讀取試煉…</p><button class="btn" data-awake-action="close">關閉</button></section>');
    await refresh({ renderMode: ['tasks', 'collection'] }); render();
  }
  async function action(name) {
    if (name === 'close') { closeModal(); petId = null; return; }
    if (busy || !pet()) return;
    const actionPetId = petId;
    busy = true;
    document.querySelectorAll('[data-awake-action]').forEach((b) => { b.disabled = true; });
    try {
      if (name === 'workshop' || name === 'expedition') { closeModal(); switchView(name); return; }
      if (name === 'start') await startPetAwakening(actionPetId);
      if (name === 'pause') await pausePetAwakening(actionPetId);
      if (name === 'pause-other') await pausePetAwakening(getState().petAwakening.activePetId);
      if (name === 'initial' || name === 'awakened') await setAwakeningForm(actionPetId, name);
      if (name === 'awaken' || name === 'replay') {
        const entry = name === 'awaken' ? (await awakenPet(actionPetId)).entry : getState().awakeningCatalog.pets.find((p) => p.petId === actionPetId);
        // Always reveal the official portrait, regardless of selected initial appearance.
        const officialPet = getState().allPets.find((p) => p.id === actionPetId);
        await playAwakeningScene(entry, officialPet);
        if (name === 'awaken') showToast(`與${entry.name}完成覺醒，雙形態與稱號已開放。`, 'success');
      }
      await refresh({ renderMode: ['tasks', 'collection', 'expedition'] }); render();
    } catch (error) {
      const target = document.querySelector('[data-awake-error]');
      if (target) target.textContent = error.message; else showToast(error.message, 'error');
    } finally {
      busy = false;
      // Restore actions using state eligibility; keep any failure message visible.
      const error = document.querySelector('[data-awake-error]')?.textContent;
      render();
      if (error && document.querySelector('[data-awake-error]')) document.querySelector('[data-awake-error]').textContent = error;
    }
  }
  return { mount() {
    document.addEventListener('click', trackUpdateActivity(async (event) => {
      const opener = event.target.closest('[data-awake-open]');
      const button = event.target.closest('[data-awake-action]');
      if (opener) { event.preventDefault(); await open(opener.dataset.awakeOpen); }
      else if (button) { event.preventDefault(); await action(button.dataset.awakeAction); }
    }));
  } };
}
