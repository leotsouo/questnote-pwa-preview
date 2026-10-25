/**
 * Moving a save from the web app (PWA) to the iOS app. Both sides keep their own
 * IndexedDB, so the move is the existing backup file: export on the web, restore in
 * the app. This module holds the pure parts both screens share: the summary the user
 * compares on both devices, the first-open check and the file helpers.
 */
import { previewBackup } from './backupService.js';

/** Rows shown on the web export screen and again in the app after the move. */
export const MIGRATION_SUMMARY_ROWS = Object.freeze([
  ['taskCount', '任務'],
  ['completedTaskCount', '已完成任務'],
  ['habitCount', '習慣'],
  ['petCount', '寵物'],
  ['stardust', '星塵'],
  ['adventureEnergy', '冒險能量'],
  ['totalPulls', '召喚次數'],
  ['unlockedAchievementCount', '已解鎖成就'],
]);

/**
 * Summary of a normalized backup (normalizeBackupPayload output). The web export and
 * the app's re-export after restore both go through this, so equal numbers mean the
 * same save arrived.
 */
export function summarizeBackupForMigration(normalizedBackup) {
  const preview = previewBackup(normalizedBackup);
  return {
    taskCount: preview.taskCount,
    completedTaskCount: preview.completedTaskCount,
    habitCount: preview.habitCount,
    petCount: preview.collectionCount,
    stardust: preview.stardust,
    adventureEnergy: preview.adventureEnergy,
    totalPulls: Number(normalizedBackup?.gachaStats?.totalPulls) || 0,
    unlockedAchievementCount: preview.unlockedAchievementCount,
  };
}

/** Labels of the rows that differ between two summaries; empty when they match. */
export function compareMigrationSummaries(expected, actual) {
  return MIGRATION_SUMMARY_ROWS
    .filter(([key]) => expected?.[key] !== actual?.[key])
    .map(([, label]) => label);
}

/**
 * The app offers "從網頁版搬過來" only on its very first open: the iOS profile, the
 * first-run practice still on its welcome step, and nothing saved yet.
 */
export function shouldOfferWebMigration({ profile, guided, taskCount = 0, petCount = 0, habitCount = 0 } = {}) {
  return profile === 'ios'
    && guided?.status === 'active'
    && guided.mode === 'first'
    && guided.step === 'WELCOME'
    && taskCount === 0 && petCount === 0 && habitCount === 0;
}

/** Same name pattern as the settings export, so either file can be picked in the app. */
export function migrationFileName(date = new Date()) {
  return `questnote-backup-${date.toISOString().split('T')[0]}.json`;
}

/** iOS Safari shares files (save to Files, AirDrop); other browsers fall back to a download. */
export function canShareBackupFile(nav, file) {
  try {
    return typeof nav?.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}
