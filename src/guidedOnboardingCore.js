/** Versioned, deterministic practice checkpoints. No DOM or persistence. */
export const GUIDED_KEY = 'guidedOnboarding';
export const ONBOARDING_VERSION = 1;
export const STARTER_PET_ID = 'pet_n01';
export const TUTORIAL_CONTENT = '完成我的第一個 Quest\n我已練習新增任務，現在試著把它完成。';
export const GUIDED_STEPS = Object.freeze(['WELCOME', 'MEET_COMPANION', 'HOME_INTRO',
  'OPEN_CREATE_QUEST', 'CREATE_TUTORIAL_QUEST', 'RETURN_HOME', 'COMPLETE_TUTORIAL_QUEST',
  'REWARD_REVEAL', 'COMPANION_REACTION', 'FINISH']);

export function normalizeGuidedState(raw = {}) {
  return {
    ...raw, key: GUIDED_KEY, schemaVersion: 1, onboardingVersion: ONBOARDING_VERSION,
    status: ['active', 'completed', 'skipped', 'existing'].includes(raw.status) ? raw.status : 'existing',
    step: GUIDED_STEPS.includes(raw.step) ? raw.step : 'WELCOME',
    mode: raw.mode === 'replay' ? 'replay' : 'first',
    runId: typeof raw.runId === 'string' ? raw.runId : 'first',
    taskId: typeof raw.taskId === 'string' ? raw.taskId : null,
    onboardingCompletedVersion: Number(raw.onboardingCompletedVersion) || 0,
    reward: raw.reward || null,
  };
}

export function initialGuidedState(snapshot, legacy) {
  // Even an empty legacy profile is an existing installation. Do not force upgrades.
  const fresh = !legacy && ['tasks', 'meta', 'collection', 'expeditions', 'habits']
    .every((key) => Array.isArray(snapshot?.[key]) && snapshot[key].length === 0);
  return normalizeGuidedState({ status: fresh ? 'active' : 'existing' });
}

const ACKNOWLEDGEMENTS = {
  WELCOME: 'MEET_COMPANION', MEET_COMPANION: 'HOME_INTRO', HOME_INTRO: 'OPEN_CREATE_QUEST',
  RETURN_HOME: 'COMPLETE_TUTORIAL_QUEST', REWARD_REVEAL: 'COMPANION_REACTION',
  COMPANION_REACTION: 'FINISH',
};

export function transitionGuidedState(raw, event, detail = {}) {
  const s = normalizeGuidedState(raw);
  if (s.status !== 'active') return s;
  // A click belongs to the screen the user saw, even if another window advanced it.
  if ((detail.expectedStep && detail.expectedStep !== s.step)
    || (detail.expectedRunId && detail.expectedRunId !== s.runId)) return s;
  if (event === 'acknowledge' && ACKNOWLEDGEMENTS[s.step]) return { ...s, step: ACKNOWLEDGEMENTS[s.step] };
  if (event === 'editor-opened' && s.step === 'OPEN_CREATE_QUEST') return { ...s, step: 'CREATE_TUTORIAL_QUEST' };
  if (event === 'task-created' && s.step === 'CREATE_TUTORIAL_QUEST'
    && detail.isTutorial && detail.runId === s.runId) return { ...s, step: 'RETURN_HOME', taskId: detail.taskId };
  if (event === 'task-completed' && ['RETURN_HOME', 'COMPLETE_TUTORIAL_QUEST'].includes(s.step)
    && s.taskId === detail.taskId && detail.reward) return { ...s, step: 'REWARD_REVEAL', reward: detail.reward };
  if (event === 'finish' && s.step === 'FINISH') return { ...s, status: 'completed',
    onboardingCompletedVersion: ONBOARDING_VERSION };
  if (event === 'skip-confirmed') return { ...s, status: 'skipped' };
  return s;
}

export function recoverGuidedState(raw, tasks) {
  const s = normalizeGuidedState(raw);
  if (s.status !== 'active') return s;
  const task = tasks.find((t) => t.isTutorial && t.tutorialRunId === s.runId);
  if (task?.rewardClaimed && GUIDED_STEPS.indexOf(s.step) < GUIDED_STEPS.indexOf('REWARD_REVEAL')) {
    return { ...s, step: 'REWARD_REVEAL', taskId: task.id, reward: task.tutorialReward };
  }
  if (task && !task.completed && ['OPEN_CREATE_QUEST', 'CREATE_TUTORIAL_QUEST'].includes(s.step)) {
    return { ...s, step: 'RETURN_HOME', taskId: task.id };
  }
  if (!task && ['RETURN_HOME', 'COMPLETE_TUTORIAL_QUEST'].includes(s.step)) {
    return { ...s, step: 'OPEN_CREATE_QUEST', taskId: null };
  }
  return s;
}

export function tutorialDraft(raw) {
  const s = normalizeGuidedState(raw);
  if (s.status !== 'active' || !['OPEN_CREATE_QUEST', 'CREATE_TUTORIAL_QUEST'].includes(s.step)) return null;
  return { isTutorial: true, tutorialRunId: s.runId, tutorialMode: s.mode,
    id: `tutorial:${s.runId}`, content: TUTORIAL_CONTENT, priority: 'normal', categoryId: 'general', planToday: true };
}

/** Keep the initial reward small; replay shows the receipt without changing the economy. */
export function tutorialReward(mode) {
  return { amount: 20, energy: 1, bondAmount: 5, preview: mode === 'replay' };
}
