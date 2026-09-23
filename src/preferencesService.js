/**
 * 使用者偏好設定 — 自動補齊舊資料預設值
 */
import { dbGet, dbPut, STORES } from './db.js';

const PREFS_KEY = 'userPreferences';

const VALID_THEMES = ['default', 'sweet'];

const DEFAULT_PREFS = {
  key: PREFS_KEY,
  reduceMotion: false,
  theme: 'default',
};

/**
 * 正規化主題值
 * @param {string|undefined} theme
 */
export function normalizeTheme(theme) {
  return VALID_THEMES.includes(theme) ? theme : 'default';
}

/**
 * 正規化偏好設定
 * @param {object|null} prefs
 */
export function normalizeUserPreferences(prefs) {
  if (!prefs) return { ...DEFAULT_PREFS };
  return {
    key: PREFS_KEY,
    // Legacy App toggle was removed. System prefers-reduced-motion remains active.
    reduceMotion: false,
    theme: normalizeTheme(prefs.theme),
  };
}

/**
 * 將主題套用到 document（同步，供啟動時儘早呼叫）
 * @param {string} theme
 */
export function applyThemeToDocument(theme) {
  const valid = normalizeTheme(theme);
  document.body.dataset.theme = valid;
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.content = valid === 'sweet' ? '#FFF7FB' : '#080B16';
  }
  return valid;
}

/** 取得使用者偏好 */
export async function getUserPreferences() {
  const prefs = await dbGet(STORES.META, PREFS_KEY);
  return normalizeUserPreferences(prefs);
}

/** 初始化偏好（首次使用或遷移舊資料） */
export async function initUserPreferences() {
  const prefs = await getUserPreferences();
  await dbPut(STORES.META, prefs);
  return prefs;
}

/** 設定美術風格主題 */
export async function setTheme(theme) {
  const prefs = await getUserPreferences();
  prefs.theme = normalizeTheme(theme);
  await dbPut(STORES.META, prefs);
  return prefs;
}
