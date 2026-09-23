/**
 * IndexedDB 封裝 — 所有資料持久化操作
 */
import { RELEASE_PROFILE } from './releaseProfile.js';

// A release profile is authoritative on every host, including local rehearsals.
const PROFILE_DATABASES = Object.freeze({ production: 'QuestNoteDB', preview: 'QuestNotePreviewDB' });
if (RELEASE_PROFILE !== null && (!Object.hasOwn(PROFILE_DATABASES, RELEASE_PROFILE.profile)
  || RELEASE_PROFILE.dbName !== PROFILE_DATABASES[RELEASE_PROFILE.profile])) {
  throw new Error('Invalid release database profile');
}
// Preserve existing source-checkout isolation until an artifact supplies its profile.
const LEGACY_DB_NAME = typeof location !== 'undefined'
  && location.hostname === 'leotsouo.github.io'
  && location.pathname.startsWith('/questnote-pwa-preview/')
  ? 'QuestNotePreviewDB'
  : 'QuestNoteDB';
const DB_NAME = RELEASE_PROFILE?.dbName || LEGACY_DB_NAME;
const DB_VERSION = 3;

const STORES = {
  TASKS: 'tasks',
  META: 'meta',
  COLLECTION: 'collection',
  EXPEDITIONS: 'expeditions',
  HABITS: 'habits',
};

/** @type {IDBDatabase|null} */
let dbInstance = null;

/**
 * 開啟或取得資料庫連線
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORES.TASKS)) {
        db.createObjectStore(STORES.TASKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORES.COLLECTION)) {
        db.createObjectStore(STORES.COLLECTION, { keyPath: 'petId' });
      }
      if (!db.objectStoreNames.contains(STORES.EXPEDITIONS)) {
        db.createObjectStore(STORES.EXPEDITIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.HABITS)) {
        db.createObjectStore(STORES.HABITS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onclose = () => {
        dbInstance = null;
      };
      resolve(dbInstance);
    };
  });
}

/**
 * 通用 get 操作
 */
export async function dbGet(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 通用 put 操作
 */
export async function dbPut(storeName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(value);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error || request.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

/**
 * 通用 delete 操作
 */
export async function dbDelete(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || request.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

/**
 * 取得 store 全部資料
 */
export async function dbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 清空指定 store
 */
export async function dbClear(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || request.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

/**
 * Read records and synchronously reduce them inside one readwrite transaction.
 * The reducer returns { puts: [{ store, value }], result }. Never await inside it:
 * IndexedDB may commit when the current request callback returns.
 */
export async function dbMutateRecords(reads, reduce) {
  if (!Array.isArray(reads) || !reads.length || typeof reduce !== 'function') {
    throw new TypeError('Invalid IndexedDB mutation');
  }
  const names = [...new Set(reads.map((read) => read.store))];
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, 'readwrite');
    const records = new Array(reads.length);
    let remaining = reads.length;
    let result;
    let failure = null;
    const abort = (error) => {
      failure = error;
      try { tx.abort(); } catch { /* The native transaction may already be aborted. */ }
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(failure || tx.error || new Error('IndexedDB mutation failed'));
    tx.onabort = () => reject(failure || tx.error || new Error('IndexedDB mutation aborted'));
    try {
      reads.forEach((read, index) => {
        const store = tx.objectStore(read.store);
        const request = read.all ? store.getAll() : store.get(read.key);
        request.onerror = () => { failure = request.error; };
        request.onsuccess = () => {
          records[index] = request.result ?? (read.all ? [] : null);
          if (--remaining) return;
          try {
            const update = reduce(records);
            if (update && typeof update.then === 'function') {
              // Consume a rejected async callback without accepting its delayed writes.
              Promise.resolve(update).catch(() => {});
              throw new TypeError('IndexedDB reducer must return a synchronous mutation');
            }
            if (!update) {
              throw new TypeError('IndexedDB reducer must return a synchronous mutation');
            }
            for (const write of update.puts || []) {
              if (!names.includes(write.store)) throw new Error('Mutation writes outside locked stores');
              tx.objectStore(write.store).put(write.value);
            }
            result = update.result;
          } catch (error) { abort(error); }
        };
      });
    } catch (error) { abort(error); }
  });
}

/** Update one fresh record; returning null skips the write. */
export function dbUpdateRecord(store, key, reduce) {
  return dbMutateRecords([{ store, key }], ([raw]) => {
    const value = reduce(raw);
    if (value && typeof value.then === 'function') {
      Promise.resolve(value).catch(() => {});
      throw new TypeError('Record updater must be synchronous');
    }
    return { puts: value == null ? [] : [{ store, value }], result: value };
  });
}

/**
 * 清空所有資料（重置用）
 */
export async function clearAllData() {
  await dbClear(STORES.TASKS);
  await dbClear(STORES.META);
  await dbClear(STORES.COLLECTION);
  await dbClear(STORES.EXPEDITIONS);
  await dbClear(STORES.HABITS);
}

const ALL_STORE_NAMES = [
  STORES.TASKS,
  STORES.META,
  STORES.COLLECTION,
  STORES.EXPEDITIONS,
  STORES.HABITS,
];

/** Read a single committed database snapshot without running service migrations. */
export async function readAllStoresSnapshot() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ALL_STORE_NAMES, 'readonly');
    const snapshot = {};
    tx.oncomplete = () => resolve(snapshot);
    tx.onerror = () => reject(tx.error || new Error('Snapshot read failed'));
    tx.onabort = () => reject(tx.error || new Error('Snapshot read aborted'));
    for (const name of ALL_STORE_NAMES) {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => { snapshot[name] = request.result; };
    }
  });
}

/**
 * 以單一 transaction 安全覆蓋全部 stores（匯入恢復用）
 * transaction 失敗時會自動 rollback，不會留下半套資料
 * @param {object} payload
 */
export async function replaceAllStores(payload) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ALL_STORE_NAMES, 'readwrite');
    let writeError = null;

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(writeError || tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(writeError || tx.error || new Error('IndexedDB transaction aborted'));

    // A synchronous DataError/DataCloneError must abort the queued clears too.
    try {
      for (const storeName of ALL_STORE_NAMES) {
        tx.objectStore(storeName).clear();
      }

      const tasksStore = tx.objectStore(STORES.TASKS);
      for (const task of payload.tasks || []) {
        tasksStore.put(task);
      }

      const collectionStore = tx.objectStore(STORES.COLLECTION);
      for (const item of payload.collection || []) {
        collectionStore.put(item);
      }

      const expeditionsStore = tx.objectStore(STORES.EXPEDITIONS);
      for (const expedition of payload.expeditions || []) {
        expeditionsStore.put(expedition);
      }

      const habitsStore = tx.objectStore(STORES.HABITS);
      for (const habit of payload.habits || []) {
        habitsStore.put(habit);
      }

      const metaStore = tx.objectStore(STORES.META);
      if (payload.wallet) metaStore.put(payload.wallet);
      if (payload.gachaStats) metaStore.put(payload.gachaStats);
      if (payload.achievements) metaStore.put(payload.achievements);
      if (payload.taskStats) metaStore.put(payload.taskStats);
      if (payload.userPreferences) metaStore.put(payload.userPreferences);
      if (payload.inventory) metaStore.put(payload.inventory);
      if (payload.workshopStats) metaStore.put(payload.workshopStats);
      if (payload.dailyCheckIn) metaStore.put(payload.dailyCheckIn);
      if (payload.questProgress) metaStore.put(payload.questProgress);
      if (payload.explorationProgress) metaStore.put(payload.explorationProgress);
      if (payload.collectionMilestones) metaStore.put(payload.collectionMilestones);
      if (payload.globalMailboxState) metaStore.put(payload.globalMailboxState);
      if (payload.poolDebutSeen) metaStore.put(payload.poolDebutSeen);
      if (payload.poolUnlockState) metaStore.put(payload.poolUnlockState);
      if (payload.idempotentGrants) metaStore.put(payload.idempotentGrants);
    } catch (error) {
      writeError = error;
      tx.abort();
    }
  });
}

export { STORES };
