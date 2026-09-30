/**
 * 使用者偏好設定 — 自動補齊舊資料預設值
 */
import { dbGet, dbUpdateRecord, STORES } from './db.js';
import { SUPPORTED_THEMES, THEME_COLORS } from './themeRegistry.js';

const PREFS_KEY = 'userPreferences';
export const FONT_SIZES = Object.freeze(['standard', 'large', 'extra-large']);

const DEFAULT_PREFS = {
  key: PREFS_KEY,
  reduceMotion: false,
  theme: 'default',
  fontSize: 'standard',
};

/**
 * 正規化主題值
 * @param {string|undefined} theme
 */
export function normalizeTheme(theme) {
  return SUPPORTED_THEMES.includes(theme) ? theme : 'default';
}

export function normalizeFontSize(fontSize) {
  return FONT_SIZES.includes(fontSize) ? fontSize : 'standard';
}

export function applyFontSizeToDocument(fontSize) {
  const valid = normalizeFontSize(fontSize);
  document.documentElement.dataset.fontSize = valid;
  return valid;
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
    fontSize: normalizeFontSize(prefs.fontSize),
  };
}

/**
 * 將主題套用到 document（同步，供啟動時儘早呼叫）
 * @param {string} theme
 */
export function applyThemeToDocument(theme) {
  const valid = normalizeTheme(theme);
  // Root styling controls browser chrome; body styling keeps forms theme-specific.
  document.documentElement.dataset.theme = valid;
  document.body.dataset.theme = valid;
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.content = THEME_COLORS[valid];
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
  return dbUpdateRecord(STORES.META, PREFS_KEY, normalizeUserPreferences);
}

/** 設定美術風格主題 */
export async function setTheme(theme) {
  return dbUpdateRecord(STORES.META, PREFS_KEY, (raw) => ({
    ...normalizeUserPreferences(raw), theme: normalizeTheme(theme),
  }));
}

/** Persist only the text preference; retain the user's selected theme. */
export async function setFontSize(fontSize) {
  return dbUpdateRecord(STORES.META, PREFS_KEY, (raw) => ({
    ...normalizeUserPreferences(raw), fontSize: normalizeFontSize(fontSize),
  }));
}
