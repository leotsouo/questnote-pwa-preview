import { getQuestSummary, claimQuestReward, updateQuestProgress } from './questService.js';
import { getCollectionMilestoneSummary, claimCollectionMilestone } from './collectionMilestoneService.js';
import { getExplorationSummary, claimExplorationMilestone } from './explorationService.js';
import { getGlobalMailboxState, buildMailboxViewModel, claimMailboxReward } from './mailboxService.js';
import { claimAllAchievementRewards } from './achievementService.js';
import { getDailyCheckIn, hasCheckedInToday, hasSpunWheelToday, performDailyCheckIn,
  prepareDailyWheelSpin, finalizeDailyWheelSpin, isWheelSpinning, isCheckInProcessing,
  wheelRewardToBundle } from './dailyCheckInService.js';

let claiming = false;

export function isBulkClaimInProgress() {
  return claiming;
}

/** Claim a fixed snapshot sequentially; successful grants survive a later failure. */
export async function claimRewardBatch(entries, claim) {
  const results = [];
  const failures = [];
  const rewards = { stardust: 0, adventureEnergy: 0, materials: {}, items: {} };
  for (const entry of entries) {
    try {
      const result = await claim(entry);
      if (!result?.success) {
        failures.push({ entry, error: result?.error || '領取失敗' });
        continue;
      }
      results.push({ entry, ...result });
      const reward = result.reward || result.rewards || {};
      for (const key of ['stardust', 'adventureEnergy']) rewards[key] += reward[key] || 0;
      if (reward.encounterFragments > 0) rewards.encounterFragments = (rewards.encounterFragments || 0) + reward.encounterFragments;
      for (const key of ['materials', 'items']) {
        for (const [id, amount] of Object.entries(reward[key] || {})) rewards[key][id] = (rewards[key][id] || 0) + amount;
      }
    } catch (error) {
      failures.push({ entry, error: error?.message || '領取失敗' });
    }
  }
  return { success: results.length > 0, count: results.length, rewards, results, failures };
}

/** Only an explicit user action calls this. Filters never narrow the claim scope. */
export async function claimAllAvailableRewards(kind, options = {}) {
  if (claiming) return { success: false, count: 0, error: '正在領取中，請稍候' };
  claiming = true;
  try {
    if (kind === 'achievements') return await claimAllAchievementRewards(options.allPets || []);
    if (kind === 'quests') {
      const summary = await getQuestSummary();
      const entries = ['daily', 'weekly'].flatMap((scope) => summary[scope].items
        .filter((item) => item.status === 'claimable').map((item) => ({ ...item, scope })));
      return await claimRewardBatch(entries, (item) => claimQuestReward(item.id, item.scope));
    }
    if (kind === 'collection') {
      const summary = await getCollectionMilestoneSummary(options.allPets || []);
      return await claimRewardBatch(summary.items.filter((item) => item.status === 'claimable'),
        (item) => claimCollectionMilestone(item.id, options.allPets || []));
    }
    if (kind === 'exploration') {
      const summary = await getExplorationSummary();
      const entries = summary.areas.flatMap((area) => area.milestones
        .filter((item) => item.status === 'claimable').map((item) => ({ ...item, areaId: area.areaId })));
      return await claimRewardBatch(entries, (item) => claimExplorationMilestone(item.areaId, item.percent));
    }
    if (kind === 'mailbox') {
      const state = await getGlobalMailboxState();
      const summary = buildMailboxViewModel(options.payload, state, { ...options, filter: 'all' });
      return await claimRewardBatch(summary.allVisible.filter((item) => item.status.claimable),
        (item) => claimMailboxReward(item, { ...options, markRead: false }));
    }
    if (kind === 'blessing') {
      if (isWheelSpinning() || isCheckInProcessing()) return { success: false, count: 0, error: '每日祝福處理中，請稍候' };
      const daily = await getDailyCheckIn();
      const entries = [!hasCheckedInToday(daily) && 'check-in', !hasSpunWheelToday(daily) && 'wheel'].filter(Boolean);
      const result = await claimRewardBatch(entries, async (entry) => {
        if (entry === 'check-in') return performDailyCheckIn();
        const spin = await prepareDailyWheelSpin();
        if (!spin.success) return spin;
        const result = await finalizeDailyWheelSpin(spin.reward);
        return { ...result, reward: wheelRewardToBundle(spin.reward) };
      });
      if (result.results.some((item) => item.entry === 'check-in')) {
        try { await updateQuestProgress('daily_checkin'); } catch { /* Rewards are already committed. */ }
      }
      return result;
    }
    return { success: false, count: 0, error: '找不到這個領獎項目' };
  } finally {
    claiming = false;
  }
}
