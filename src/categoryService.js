/**
 * 任務分類服務 — 載入預設分類
 */

/** @type {object[]|null} */
let categoriesCatalog = null;

/** 載入分類定義 */
export async function loadCategoriesCatalog() {
  if (categoriesCatalog) return categoriesCatalog;
  try {
    const res = await fetch('./data/categories.json');
    if (!res.ok) throw new Error('無法載入分類資料');
    const data = await res.json();
    categoriesCatalog = Array.isArray(data) ? data : (data.categories || getDefaultCategories());
    return categoriesCatalog;
  } catch (err) {
    console.warn('[QuestNote] 分類資料載入失敗:', err);
    categoriesCatalog = getDefaultCategories();
    return categoriesCatalog;
  }
}

/** 離線或載入失敗時的預設分類 */
function getDefaultCategories() {
  return [
    { id: 'general', name: '一般', icon: '', color: 'gray' },
    { id: 'school', name: '課業', icon: '', color: 'blue' },
    { id: 'project', name: '專題', icon: '', color: 'purple' },
    { id: 'life', name: '生活', icon: '', color: 'green' },
    { id: 'health', name: '健康', icon: '', color: 'red' },
    { id: 'work', name: '工作', icon: '', color: 'gold' },
    { id: 'other', name: '其他', icon: '', color: 'gray' },
  ];
}

/** 取得所有分類 */
export async function getAllCategories() {
  return loadCategoriesCatalog();
}

/** 依 ID 取得分類 */
export function getCategoryById(categoryId, categories = categoriesCatalog) {
  const list = categories || getDefaultCategories();
  return list.find((c) => c.id === categoryId) ?? list.find((c) => c.id === 'general');
}

/** 分類是否有效 */
export function isValidCategoryId(categoryId, categories = categoriesCatalog) {
  const list = categories || getDefaultCategories();
  return list.some((c) => c.id === categoryId);
}
