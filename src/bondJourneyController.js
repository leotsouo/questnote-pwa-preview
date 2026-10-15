import { loadBondStories, chooseBondResponse, startBondAgreement, syncBondJourney,
  controlBondAgreement, claimBondAgreement, displayBondKeepsake } from './bondJourneyService.js';
import { renderBondOverview, renderBondChapter, renderBondSelector } from './bondJourneyView.js';
import { trackUpdateActivity } from './updateActivity.js';

export function createBondJourneyController({ getState, refresh, openModal, closeModal, showToast, switchView, portrait }) {
  let petId = null;
  let screen = 'overview';
  let chapter = 2;
  let sourceType = 'task';
  let replacing = false;
  let previewChoice = null;
  let busy = false;
  let mounted = false;
  const pet = () => getState().enrichedCollection?.find((item) => item.id === petId && item.owned);
  function render() {
    // A dismissed reader must stay closed when an asynchronous load finishes.
    if (!document.getElementById('modal-overlay')?.classList.contains('open')) return;
    const p = pet();
    if (!p) { closeModal(); return; }
    const state = getState();
    if (screen === 'chapter') openModal(renderBondChapter(p, state, chapter, previewChoice));
    else if (screen === 'selector') openModal(renderBondSelector(p, state, chapter, sourceType, replacing));
    else openModal(renderBondOverview(p, state, portrait(p)));
  }
  async function open(id) {
    petId = id;
    screen = 'overview';
    previewChoice = null;
    // Capture the opener before refresh replaces the home view.
    openModal('<section class="bond-reader" aria-busy="true"><h2>夥伴故事</h2><p>正在讀取同行紀錄…</p><button class="btn" data-bond-action="close">關閉</button></section>');
    getState().bondStories = await loadBondStories();
    await refresh({ renderMode: ['tasks', 'collection', 'expedition'] });
    render();
  }
  async function handle(target) {
    const state = getState();
    const action = target.dataset.bondAction;
    if (action === 'close') { closeModal(); return; }
    if (action === 'retry') { await open(petId); return; }
    if (action === 'overview') { screen = 'overview'; render(); return; }
    if (action === 'chapter') { chapter = Number(target.dataset.level); previewChoice = null; screen = 'chapter'; render(); return; }
    if (action === 'choice') {
      chapter = Number(target.dataset.level);
      await chooseBondResponse(petId, chapter, target.dataset.choice);
      previewChoice = target.dataset.choice;
      await refresh({ renderMode: ['tasks'] });
      render();
      return;
    }
    if (action === 'open-active') { if (state.bondJourney?.active) await open(state.bondJourney.active.petId); return; }
    if (action === 'select' || action === 'replace') {
      replacing = action === 'replace';
      chapter = replacing ? state.bondJourney.active.chapter : Number(target.dataset.level);
      if (replacing) await controlBondAgreement('pause');
      await refresh({ renderMode: ['tasks'] });
      sourceType = state.tasks?.some((task) => !task.completed && !state.bondJourney.usedEventKeys.includes(`task:${task.id}`)) ? 'task' : 'habit';
      screen = 'selector';
      render();
      return;
    }
    if (action === 'start') {
      const sourceId = document.getElementById('bond-source-id')?.value;
      if (!sourceId) throw new Error('請先選擇一項目標。');
      await startBondAgreement(petId, chapter, sourceType, sourceId, { replace: replacing });
      screen = 'overview';
      await refresh({ renderMode: ['tasks', 'collection'] });
      render();
      showToast('同行約定已開始，照自己的步調來。', 'success');
      return;
    }
    if (['pause', 'resume', 'end'].includes(action)) {
      await controlBondAgreement(action);
      screen = 'overview';
      await refresh({ renderMode: ['tasks'] });
      render();
      return;
    }
    if (action === 'claim') {
      const result = await claimBondAgreement();
      chapter = result.chapter;
      screen = chapter ? 'chapter' : 'overview';
      previewChoice = null;
      await refresh({ renderMode: ['tasks', 'collection', 'expedition'] });
      render();
      showToast(`牠收到了你的努力！星塵 +${result.amount}${chapter === 5 ? '，專屬紀念物已解鎖' : ''}`, 'success', 3500);
      return;
    }
    if (action === 'display') {
      await displayBondKeepsake(state.bondJourney.displayPetId === petId ? null : petId);
      await refresh({ renderMode: ['tasks', 'expedition'] });
      render();
      return;
    }
    if (action === 'go-source' || action === 'go-create') {
      const type = action === 'go-source' ? state.bondJourney.active?.sourceType : sourceType;
      closeModal();
      switchView(type === 'habit' ? 'habits' : 'tasks');
      return;
    }
  }
  function mount() {
    if (mounted) return;
    mounted = true;
    document.addEventListener('click', trackUpdateActivity(async (event) => {
      const target = event.target.closest('[data-bond-open], [data-bond-action]');
      if (!target || target.disabled) return;
      if (target.dataset.bondAction === 'close') { event.preventDefault(); closeModal(); return; }
      if (busy) return;
      event.preventDefault();
      busy = true;
      const controls = [...document.querySelectorAll('#modal-body [data-bond-action], #modal-body select')];
      const disabled = controls.map((control) => control.disabled);
      controls.forEach((control) => { control.disabled = true; });
      try {
        if (target.dataset.bondOpen) await open(target.dataset.bondOpen);
        else await handle(target);
      } catch (error) {
        if (target.dataset.bondOpen || target.dataset.bondAction === 'retry') render();
        showToast(error.message || '同行約定暫時無法更新，請稍後重試。', 'error');
      } finally {
        busy = false;
        controls.forEach((control, index) => { if (control.isConnected) control.disabled = disabled[index]; });
      }
    }));
    document.addEventListener('change', (event) => {
      if (busy || screen !== 'selector') return;
      if (event.target.id === 'bond-source-type') { sourceType = event.target.value; render(); }
      if (event.target.id === 'bond-source-id') {
        const start = document.getElementById('bond-start');
        if (start) start.disabled = !event.target.value;
      }
    });
  }
  return { mount, open, sync: syncBondJourney };
}
