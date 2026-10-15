import { dbGet, dbPut, dbUpdateRecord, dbMutateRecords, STORES } from './db.js';
import { normalizeEntry, createCollectionEntry, getBondLevelFromExp } from './collectionService.js';
import { getTodayDateString } from './taskFilterService.js';
import { GUIDED_KEY, STARTER_PET_ID, normalizeGuidedState, initialGuidedState,
  transitionGuidedState, recoverGuidedState, tutorialReward } from './guidedOnboardingCore.js';

export async function prepareGuidedOnboarding() {
  const saved = await dbGet(STORES.META, GUIDED_KEY);
  if (saved) return recoverGuidedOnboarding();
  // Recheck eligibility inside one transaction: two fresh windows must not
  // overwrite the first window's active record with an "existing" migration.
  const stores = [STORES.META, STORES.TASKS, STORES.COLLECTION, STORES.EXPEDITIONS, STORES.HABITS];
  return dbMutateRecords(stores.map((store) => ({ store, all: true })), ([meta, tasks, collection, expeditions, habits]) => {
    const existing = meta.find((m) => m.key === GUIDED_KEY);
    if (existing) return { puts: [], result: normalizeGuidedState(existing) };
    const s = initialGuidedState({ meta, tasks, collection, expeditions, habits }, meta.find((m) => m.key === 'onboardingV1'));
    return { puts: [{ store: STORES.META, value: s }], result: s };
  });
}

export async function recoverGuidedOnboarding() {
  return dbMutateRecords([{ store: STORES.META, key: GUIDED_KEY }, { store: STORES.TASKS, all: true }],
    ([raw, tasks]) => {
      const s = recoverGuidedState(raw, tasks);
      const puts = [{ store: STORES.META, value: s }];
      const task = tasks.find((t) => t.id === s.taskId);
      if (s.status === 'active' && task && !task.completed && task.plannedDate !== getTodayDateString()) {
        puts.push({ store: STORES.TASKS, value: { ...task, plannedDate: getTodayDateString(), isPlannedToday: true } });
      }
      return { puts, result: s };
    });
}

export async function advanceGuidedOnboarding(event, detail = {}) {
  return dbMutateRecords([{ store: STORES.META, key: GUIDED_KEY }, { store: STORES.COLLECTION, all: true }],
    ([raw, items]) => {
      const s = transitionGuidedState(raw, event, detail);
      const puts = [{ store: STORES.META, value: s }];
      if (s.status === 'active' && s.step === 'MEET_COMPANION' && s.mode === 'first' && !items.length) {
        puts.push({ store: STORES.COLLECTION, value: normalizeEntry({ ...createCollectionEntry(STARTER_PET_ID), isCompanion: true }) });
        s.starterGrantedAt = new Date().toISOString();
      }
      return { puts, result: s };
    });
}

export async function startGuidedReplay() {
  return dbMutateRecords([{ store: STORES.META, key: GUIDED_KEY }, { store: STORES.TASKS, all: true }], ([raw, tasks]) => {
    if (raw?.status === 'active') return { puts: [], result: recoverGuidedState(raw, tasks) };
    const s = normalizeGuidedState({ ...raw, status: 'active', step: 'WELCOME', mode: 'replay',
      runId: `replay-${crypto.randomUUID()}`, taskId: null, reward: null });
    // Retain the first real receipt, but do not accumulate hidden rehearsal history.
    const deletes = tasks.filter((t) => t.isTutorial && (t.tutorialMode === 'replay' || !t.completed))
      .map((t) => ({ store: STORES.TASKS, key: t.id }));
    return { puts: [{ store: STORES.META, value: s }], deletes, result: s };
  });
}

export async function commitTutorialTask(task) {
  return dbMutateRecords([{ store: STORES.META, key: GUIDED_KEY }, { store: STORES.TASKS, key: task.id }],
    ([raw, existing]) => {
      const s = normalizeGuidedState(raw);
      if (existing?.isTutorial && existing.tutorialRunId === s.runId) return { puts: [], result: existing };
      if (s.status !== 'active' || s.step !== 'CREATE_TUTORIAL_QUEST' || task.tutorialRunId !== s.runId) {
        throw new Error('練習進度已更新，請重新開啟教學。');
      }
      const next = transitionGuidedState(s, 'task-created', { isTutorial: true, runId: s.runId, taskId: task.id });
      return { puts: [{ store: STORES.TASKS, value: task }, { store: STORES.META, value: next }], result: task };
    });
}

/** Task, receipt, wallet and companion commit together. An interrupted retry cannot pay twice. */
export async function claimTutorialReward(taskId) {
  return dbMutateRecords([{ store: STORES.TASKS, key: taskId }, { store: STORES.META, key: GUIDED_KEY },
    { store: STORES.META, key: 'wallet' }, { store: STORES.COLLECTION, all: true }], ([task, raw, rawWallet, pets]) => {
    if (!task?.isTutorial) throw new Error('練習任務不存在');
    if (task.rewardClaimed) return { puts: [], result: { task, amount: 0, energy: 0, bond: null } };
    const s = normalizeGuidedState(raw);
    if (s.runId !== task.tutorialRunId || s.mode !== task.tutorialMode || s.taskId !== task.id
      || !['active', 'skipped'].includes(s.status)) throw new Error('這次練習已結束，請重新開啟教學。');
    const receipt = tutorialReward(task.tutorialMode);
    const now = new Date().toISOString();
    const updated = { ...task, completed: true, completedAt: now, rewardClaimed: true,
      lastRewardClaimedAt: now, tutorialReward: receipt, updatedAt: now };
    const next = transitionGuidedState(s, 'task-completed', { taskId, reward: receipt });
    const puts = [{ store: STORES.TASKS, value: updated }, { store: STORES.META, value: next }];
    let bond = null;
    if (!receipt.preview) {
      // One first-journey reward per local profile, even after an explicit tutorial restart.
      if (!s.firstRewardClaimedAt) {
        const wallet = { ...rawWallet, key: 'wallet', stardust: (rawWallet?.stardust || 0) + receipt.amount,
          adventureEnergy: (rawWallet?.adventureEnergy || 0) + receipt.energy };
        puts.push({ store: STORES.META, value: wallet });
        const pet = normalizeEntry(pets.find((p) => p.isCompanion));
        if (pet) {
          const exp = pet.bondExp + receipt.bondAmount;
          const saved = normalizeEntry({ ...pet, bondExp: exp, bondLevel: getBondLevelFromExp(exp) });
          puts.push({ store: STORES.COLLECTION, value: saved });
          bond = { petId: pet.petId, amount: receipt.bondAmount, newLevel: saved.bondLevel, leveledUp: saved.bondLevel > pet.bondLevel };
        }
        next.firstRewardClaimedAt = now;
      } else {
        updated.tutorialReward = { ...receipt, preview: true };
        next.reward = updated.tutorialReward;
      }
    }
    return { puts, result: { task: updated, amount: updated.tutorialReward.preview ? 0 : receipt.amount,
      energy: updated.tutorialReward.preview ? 0 : receipt.energy, bond } };
  });
}

export async function resetGuidedAfterDataReset() {
  const s = normalizeGuidedState({ status: 'active', step: 'WELCOME' });
  await dbPut(STORES.META, s);
  return s;
}

export async function dismissGuidedAfterRestore() {
  const s = normalizeGuidedState({ status: 'existing' });
  await dbPut(STORES.META, s);
  return s;
}

export function acknowledgeGuidedHint(view) {
  return dbUpdateRecord(STORES.META, GUIDED_KEY, (raw) => ({ ...raw,
    hintsAcknowledged: [...new Set([...(raw?.hintsAcknowledged || []), view])] }));
}
