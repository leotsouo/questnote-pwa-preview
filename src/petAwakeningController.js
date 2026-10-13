import { acceptDemonFinalTask, startPetAwakening, pausePetAwakening, awakenPet, setAwakeningForm } from './petAwakeningService.js';
import { renderAwakeningReader, initialAwakeningPortrait } from './petAwakeningView.js';
import { playAwakeningScene } from './petAwakeningScene.js';
import { trackUpdateActivity } from './updateActivity.js';

export function createAwakeningController({ getState, refresh, openModal, closeModal, showToast, portrait, navigate, openDetail }) {
  let petId = null;
  let busy = false;
  let mounted = false;
  let requestId = 0;
  const pet = () => getState().enrichedCollection?.find((p) => p.id === petId);
  const reader = () => document.querySelector(`.awakening-reader[data-awakening-pet="${petId}"]`);
  const clearReturn = () => document.getElementById('awakening-return')?.remove();
  function render() {
    if (!pet() || !reader() || !document.getElementById('modal-overlay')?.classList.contains('open')) return;
    const state = getState();
    const display = pet().owned ? pet() : initialAwakeningPortrait(pet(), state.awakeningCatalog);
    const draft = document.getElementById('demon-final-answer')?.value;
    openModal(renderAwakeningReader(pet(), state, portrait(display)));
    if (draft !== undefined && document.getElementById('demon-final-answer')) document.getElementById('demon-final-answer').value = draft;
    document.getElementById('awakening-question')?.focus({ preventScroll: true });
  }
  async function reload() {
    await refresh({ renderMode: ['tasks', 'collection', 'expedition'] });
    render();
  }
  async function open(id) {
    const currentRequest = ++requestId;
    petId = id;
    clearReturn();
    openModal(`<section class="awakening-reader" data-awakening-pet="${id}" aria-busy="true"><h2>羈絆覺醒</h2><p>正在讀取試煉…</p><button class="btn" data-awake-action="close">返回角色詳情</button></section>`);
    await refresh({ renderMode: ['tasks', 'collection', 'expedition'] });
    if (currentRequest === requestId) render();
  }
  function installReturn() {
    clearReturn();
    const view = document.querySelector('.view.active');
    if (!view) return;
    const panel = document.createElement('section');
    panel.id = 'awakening-return';
    panel.className = 'awakening-panel awakening-return';
    const label = document.createElement('p');
    label.textContent = `${pet()?.name || '夥伴'} · 完成後返回，會重新核對覺醒進度。`;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'btn btn--secondary';
    button.dataset.awakeAction = 'return'; button.textContent = '返回覺醒旅程';
    panel.append(label, button); (view.querySelector(':scope > .identity-surface') || view).prepend(panel);
  }
  async function action(name) {
    if (name === 'close') {
      ++requestId; const id = petId; closeModal(); clearReturn(); petId = null;
      if (id) openDetail(id);
      return;
    }
    if (!pet()) return;
    const actionPetId = petId;
    if (name === 'return') { await open(actionPetId); return; }
    if (['workshop', 'expedition', 'bond', 'story', 'daily', 'summon'].includes(name)) {
      closeModal();
      await navigate(name, actionPetId);
      installReturn();
      return;
    }
    if (name === 'answer') {
      await acceptDemonFinalTask(actionPetId, document.getElementById('demon-final-answer')?.value);
      showToast('惡魔的趣味已排入今日。這個約定不能刪除，只能完成；沒有截止日。', 'success');
    }
    if (name === 'start') await startPetAwakening(actionPetId);
    if (name === 'pause') await pausePetAwakening(actionPetId);
    if (name === 'switch' || name === 'pause-other') {
      const otherId = getState().petAwakening?.activePetId;
      if (otherId && otherId !== actionPetId) await pausePetAwakening(otherId);
      if (name === 'switch') await startPetAwakening(actionPetId);
    }
    if (name === 'initial' || name === 'awakened') await setAwakeningForm(actionPetId, name);
    if (name === 'awaken' || name === 'replay') {
      const entry = name === 'awaken' ? (await awakenPet(actionPetId)).entry : getState().awakeningCatalog.pets.find((p) => p.petId === actionPetId);
      const officialPet = getState().allPets.find((p) => p.id === actionPetId);
      // The transaction is already committed. A visual failure must not hide success.
      try { await playAwakeningScene(entry, officialPet); }
      catch { showToast('覺醒紀錄已保留，可稍後重播演出。', 'info'); }
      if (name === 'awaken') showToast(`與${entry.name}完成覺醒，雙形態與稱號已開放。`, 'success');
    }
    await reload();
  }
  async function run(work) {
    if (busy) return;
    busy = true;
    document.querySelectorAll('[data-awake-action]').forEach((button) => { button.disabled = true; });
    let failure = '';
    try { await work(); }
    catch (error) {
      failure = error.message || '覺醒進度暫時無法更新，請重試。';
      // Read actual persisted state after failures (including partial pause/switch).
      try { await reload(); } catch { /* Original data and current reader remain available. */ }
    } finally {
      busy = false;
      render();
      document.querySelectorAll('#awakening-return [data-awake-action]').forEach((button) => { button.disabled = false; });
      if (failure) {
        const target = document.querySelector('[data-awake-error]');
        if (target) target.textContent = failure;
        else showToast(failure, 'error');
        document.querySelectorAll('.awakening-reader [data-awake-action="close"]').forEach((button) => { button.disabled = false; });
      }
    }
  }
  return { mount() {
    if (mounted) return;
    mounted = true;
    document.addEventListener('click', trackUpdateActivity(async (event) => {
      const detail = event.target.closest('[data-awake-detail]');
      const opener = event.target.closest('[data-awake-open]');
      const button = event.target.closest('[data-awake-action]');
      if ((!detail && !opener && !button) || (detail || opener || button).disabled) return;
      event.preventDefault();
      if (detail) { clearReturn(); openDetail(detail.dataset.awakeDetail); return; }
      if (button?.dataset.awakeAction === 'close') { await action('close'); return; }
      await run(() => opener ? open(opener.dataset.awakeOpen) : action(button.dataset.awakeAction));
    }));
    window.addEventListener('focus', () => { if (reader()) void run(reload); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && reader()) void run(reload); });
  } };
}
