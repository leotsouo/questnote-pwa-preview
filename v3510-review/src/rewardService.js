/**
 * 星塵獎勵計算與發放
 */
import { openDB, dbGet, dbPut, dbUpdateRecord, STORES } from './db.js';
import { updateTask } from './taskService.js';
import { addBondExpToCompanion } from './collectionService.js';

const WALLET_KEY = 'wallet';
const INVENTORY_KEY = 'inventory';

/** 預設材料 */
export const DEFAULT_MATERIALS = {
  forest_leaf: 0,
  lava_core: 0,
  machine_part: 0,
  star_shard: 0,
  aurora_ice: 0,
  harvest_charm: 0,
};

/** 各重要程度的冒險能量獎勵 */
const PRIORITY_ENERGY = {
  normal: 1,
  important: 2,
  urgent: 3,
};

/** 各重要程度的基礎獎勵 */
const PRIORITY_REWARDS = {
  normal: 20,
  important: 45,
  urgent: 80,
};

/** 抽卡單次消耗（供 UI 計算可抽次數） */
export const GACHA_COST = 100;

/** 10 連抽消耗 */
export const GACHA_TEN_COST = 1000;

/** 各重要程度親密度獎勵 */
const PRIORITY_BOND = {
  normal: 5,
  important: 12,
  urgent: 20,
};

/**
 * 計算任務完成應得親密度
 */
export function calculateBondAmount(task) {
  return PRIORITY_BOND[task.priority] ?? PRIORITY_BOND.normal;
}

/**
 * 計算任務完成應得星塵
 */
export function calculateRewardAmount(task) {
  return PRIORITY_REWARDS[task.priority] ?? PRIORITY_REWARDS.normal;
}

/**
 * 判斷任務是否可領取獎勵
 */
export function canClaimReward(task) {
  return !task.rewardClaimed;
}

/**
 * 計算任務完成應得冒險能量
 */
export function calculateAdventureEnergyAmount(task) {
  return PRIORITY_ENERGY[task.priority] ?? PRIORITY_ENERGY.normal;
}

/**
 * 正規化錢包資料，補齊舊版缺少的欄位
 */
export function normalizeWallet(wallet) {
  if (!wallet) {
    return {
      key: WALLET_KEY,
      stardust: 0,
      adventureEnergy: 0,
      materials: { ...DEFAULT_MATERIALS },
    };
  }
  return {
    key: WALLET_KEY,
    stardust: wallet.stardust ?? 0,
    adventureEnergy: wallet.adventureEnergy ?? 0,
    materials: { ...DEFAULT_MATERIALS, ...(wallet.materials || {}) },
  };
}

/** 取得錢包資料 */
export async function getWallet() {
  const wallet = await dbGet(STORES.META, WALLET_KEY);
  return normalizeWallet(wallet);
}

function updateWallet(update) {
  return dbUpdateRecord(STORES.META, WALLET_KEY, (raw) => {
    const wallet = normalizeWallet(raw);
    update(wallet);
    return wallet;
  });
}

/** 增加冒險能量 */
export async function addAdventureEnergy(amount) {
  if (amount <= 0) return getWallet();
  return updateWallet((wallet) => {
    wallet.adventureEnergy = (wallet.adventureEnergy || 0) + amount;
  });
}

/** 扣除冒險能量 */
export async function spendAdventureEnergy(amount) {
  return updateWallet((wallet) => {
    if ((wallet.adventureEnergy || 0) < amount) throw new Error('冒險能量不足');
    wallet.adventureEnergy -= amount;
  });
}

/** 增加材料 */
export async function addMaterial(materialId, amount) {
  if (amount <= 0) return getWallet();
  return updateWallet((wallet) => {
    wallet.materials[materialId] = (wallet.materials[materialId] || 0) + amount;
  });
}

/** 扣除材料 */
export async function spendMaterial(materialId, amount) {
  if (amount <= 0) return getWallet();
  return updateWallet((wallet) => {
    const current = wallet.materials[materialId] || 0;
    if (current < amount) throw new Error('材料不足');
    wallet.materials[materialId] = current - amount;
  });
}

/** 一次扣除多種材料（全部足夠才扣） */
export async function spendMaterials(recipe) {
  return updateWallet((wallet) => {
    for (const [matId, amount] of Object.entries(recipe || {})) {
      if ((wallet.materials[matId] || 0) < amount) throw new Error('材料不足');
    }
    for (const [matId, amount] of Object.entries(recipe || {})) {
      wallet.materials[matId] = (wallet.materials[matId] || 0) - amount;
    }
  });
}

/** 設定星塵數量 */
export async function setStardust(amount) {
  return updateWallet((wallet) => { wallet.stardust = Math.max(0, amount); });
}

/** 增加星塵 */
export async function addStardust(amount) {
  return updateWallet((wallet) => { wallet.stardust = (wallet.stardust || 0) + amount; });
}

/** 扣除星塵，餘額不足時拋錯 */
export async function spendStardust(amount) {
  return updateWallet((wallet) => {
    if ((wallet.stardust || 0) < amount) throw new Error('星塵不足');
    wallet.stardust -= amount;
  });
}

/**
 * 完成任務後領取獎勵（星塵 + 冒險能量 + 陪伴寵物親密度）
 * @returns {{ task: object, amount: number, energy: number, bond: object|null }}
 */
export async function claimTaskReward(task) {
  if (!canClaimReward(task)) {
    return { task, amount: 0, energy: 0, bond: null };
  }

  const amount = calculateRewardAmount(task);
  const energy = calculateAdventureEnergyAmount(task);

  await addStardust(amount);
  if (energy > 0) {
    await addAdventureEnergy(energy);
  }

  const now = new Date().toISOString();
  const updates = {
    rewardClaimed: true,
    lastRewardClaimedAt: now,
  };

  const updatedTask = await updateTask(task.id, updates);

  // 陪伴寵物親密度（與星塵共用防刷規則）
  const bondAmount = calculateBondAmount(task);
  const bond = await addBondExpToCompanion(bondAmount);

  return { task: updatedTask, amount, energy, bond };
}

/** 計算目前可抽卡次數 */
export async function getAvailablePulls() {
  const wallet = await getWallet();
  return Math.floor((wallet.stardust || 0) / GACHA_COST);
}

/** 初始化錢包（首次使用或遷移舊資料） */
export async function initWallet() {
  await updateWallet(() => {});
}

/**
 * 增加道具庫存（簽到 / 轉盤獎勵用）
 */
export async function addInventoryItem(itemId, amount = 1) {
  if (!itemId || amount <= 0) {
    const inv = await dbGet(STORES.META, INVENTORY_KEY);
    return inv || { key: INVENTORY_KEY, items: {}, itemUsageLogs: {} };
  }
  const existing = await dbGet(STORES.META, INVENTORY_KEY);
  const inventory = existing && typeof existing === 'object'
    ? {
        key: INVENTORY_KEY,
        items: { ...(existing.items || {}) },
        itemUsageLogs: { ...(existing.itemUsageLogs || {}) },
      }
    : { key: INVENTORY_KEY, items: {}, itemUsageLogs: {} };
  inventory.items[itemId] = (inventory.items[itemId] || 0) + amount;
  await dbPut(STORES.META, inventory);
  return inventory;
}

/**
 * 套用獎勵 bundle（星塵、能量、材料、道具）
 * @param {{ stardust?: number, adventureEnergy?: number, materials?: object, items?: object }} bundle
 */
export async function applyRewardBundle(bundle) {
  if (!bundle) return;
  if (bundle.stardust > 0) await addStardust(bundle.stardust);
  if (bundle.adventureEnergy > 0) await addAdventureEnergy(bundle.adventureEnergy);
  if (bundle.materials) {
    for (const [id, amt] of Object.entries(bundle.materials)) {
      if (amt > 0) await addMaterial(id, amt);
    }
  }
  if (bundle.items) {
    for (const [id, amt] of Object.entries(bundle.items)) {
      if (amt > 0) await addInventoryItem(id, amt);
    }
  }
}

/**
 * 以單一 IndexedDB transaction 發放星塵並更新同一個 meta 狀態。
 * updateState 回傳 null 代表狀態已處理，transaction 不寫入也不發獎。
 * 適用於需要防止跨頁／快速連點重複領取的里程碑。
 * @param {{ stardust: number, stateKey: string, updateState: (rawState: object|null) => object|null }} options
 * @returns {Promise<object|null>}
 */
export async function applyStardustRewardAndUpdateMeta(options) {
  const amount = Math.max(0, Number(options?.stardust) || 0);
  const stateKey = options?.stateKey;
  const updateState = options?.updateState;
  if (!stateKey || typeof updateState !== 'function') {
    throw new Error('獎勵狀態更新參數無效');
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.META, 'readwrite');
    const store = tx.objectStore(STORES.META);
    const walletRequest = store.get(WALLET_KEY);
    const stateRequest = store.get(stateKey);
    let walletReady = false;
    let stateReady = false;
    let resultState = null;
    let pendingError = null;
    let processed = false;

    const processRecords = () => {
      if (processed || !walletReady || !stateReady) return;
      processed = true;
      try {
        const nextState = updateState(stateRequest.result ?? null);
        if (!nextState) return;
        const wallet = normalizeWallet(walletRequest.result);
        wallet.stardust = (wallet.stardust || 0) + amount;
        store.put(wallet);
        store.put(nextState);
        resultState = nextState;
      } catch (error) {
        pendingError = error;
        tx.abort();
      }
    };

    walletRequest.onsuccess = () => {
      walletReady = true;
      processRecords();
    };
    stateRequest.onsuccess = () => {
      stateReady = true;
      processRecords();
    };
    walletRequest.onerror = () => {
      pendingError = walletRequest.error;
    };
    stateRequest.onerror = () => {
      pendingError = stateRequest.error;
    };
    tx.oncomplete = () => resolve(resultState);
    tx.onerror = () => reject(pendingError || tx.error || new Error('獎勵 transaction 失敗'));
    tx.onabort = () => reject(pendingError || tx.error || new Error('獎勵 transaction 已中止'));
  });
}
