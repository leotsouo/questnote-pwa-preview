/**
 * QuestNote 版本資訊 — 單一來源
 * 發佈新版時請同步更新 service-worker.js 的 CACHE_NAME
 */
import { RELEASE_PROFILE } from './releaseProfile.js';

export const APP_VERSION = '3.4.33';
export const CACHE_NAME = 'questnote-preview-app-2e0edb41bb6e27c56a6a485c2a958353d4467a44e064f90423f5fb65285d2e98';
export const PET_IMAGE_CACHE = 'questnote-preview-pet-images-v1';
export const MAILBOX_RUNTIME_CACHE = 'questnote-preview-mailbox-runtime-v1';
/** ISO 8601 — 每次發佈請更新 */
export const BUILD_TIME = '2026-09-30T19:22:03.398Z';

export function formatDisplayVersion() {
  return `V${APP_VERSION}`;
}

export function formatBuildTimeLocal() {
  try {
    return new Intl.DateTimeFormat('zh-Hant-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(BUILD_TIME));
  } catch {
    return BUILD_TIME;
  }
}

export function getServiceWorkerRegisterUrl() {
  return './service-worker.js?artifact=2e0edb41bb6e27c56a6a485c2a958353d4467a44e064f90423f5fb65285d2e98';
}
