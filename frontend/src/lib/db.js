// IndexedDB helper with safer transactions, bulk ops, and cleanup

const DB_NAME = 'SecureChannelX_DB';
const DB_VERSION = 1;

const STORES = {
  KEYS: 'keys',
  SESSIONS: 'sessions',
  SENDER_KEYS: 'sender_keys',
};

let dbPromise = null;

export const initDB = () => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      const db = event.target.result;

      // Auto-close on version change
      db.onversionchange = () => {
        try {
          db.close();
          console.warn('IndexedDB closed due to version change');
        } catch {}
      };

      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORES.KEYS)) {
        db.createObjectStore(STORES.KEYS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
        db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.SENDER_KEYS)) {
        db.createObjectStore(STORES.SENDER_KEYS, { keyPath: 'id' });
      }
    };
  });

  return dbPromise;
};

const performTransaction = async (storeName, mode, operation) => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);

    let lastResult = undefined;
    try {
      const opResult = operation(store);

      const requests = Array.isArray(opResult) ? opResult : [opResult];

      requests.forEach((req) => {
        // Allow operations that don't return a request (e.g., computed values)
        if (!req || typeof req.addEventListener !== 'function') {
          lastResult = opResult;
          return;
        }

        req.addEventListener('success', (e) => {
          lastResult = e.target.result;
        });
        req.addEventListener('error', (e) => {
          reject(req.error || e.target.error);
        });
      });
    } catch (err) {
      reject(err);
    }

    tx.oncomplete = () => resolve(lastResult);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
};

// Convenience helpers
const bulkPut = (storeName, items) =>
  performTransaction(storeName, 'readwrite', (store) =>
    items.map(({ id, value }) => store.put({ id, ...value }))
  );

const getAll = (storeName) =>
  performTransaction(storeName, 'readonly', (store) => store.getAll());

const getAllKeys = (storeName) =>
  performTransaction(storeName, 'readonly', (store) => {
    if ('getAllKeys' in store) return store.getAllKeys();
    // Fallback if getAllKeys not supported
    const keys = [];
    const req = store.openCursor();
    req.addEventListener('success', (e) => {
      const cursor = e.target.result;
      if (cursor) {
        keys.push(cursor.key);
        cursor.continue();
      }
    });
    return req;
  });

const clearStore = (storeName) =>
  performTransaction(storeName, 'readwrite', (store) => store.clear());

export const db = {
  keys: {
    put: (id, data) =>
      performTransaction(STORES.KEYS, 'readwrite', (store) => store.put({ id, ...data })),
    get: (id) =>
      performTransaction(STORES.KEYS, 'readonly', (store) => store.get(id)),
    delete: (id) =>
      performTransaction(STORES.KEYS, 'readwrite', (store) => store.delete(id)),
    getAll: () => getAll(STORES.KEYS),
    getAllKeys: () => getAllKeys(STORES.KEYS),
    clear: () => clearStore(STORES.KEYS),
    bulkPut: (items) => bulkPut(STORES.KEYS, items),
  },
  sessions: {
    put: (id, data) =>
      performTransaction(STORES.SESSIONS, 'readwrite', (store) => store.put({ id, ...data })),
    get: (id) =>
      performTransaction(STORES.SESSIONS, 'readonly', (store) => store.get(id)),
    delete: (id) =>
      performTransaction(STORES.SESSIONS, 'readwrite', (store) => store.delete(id)),
    getAll: () => getAll(STORES.SESSIONS),
    getAllKeys: () => getAllKeys(STORES.SESSIONS),
    clear: () => clearStore(STORES.SESSIONS),
    bulkPut: (items) => bulkPut(STORES.SESSIONS, items),
  },
  senderKeys: {
    put: (id, data) =>
      performTransaction(STORES.SENDER_KEYS, 'readwrite', (store) => store.put({ id, ...data })),
    get: (id) =>
      performTransaction(STORES.SENDER_KEYS, 'readonly', (store) => store.get(id)),
    delete: (id) =>
      performTransaction(STORES.SENDER_KEYS, 'readwrite', (store) => store.delete(id)),
    getAll: () => getAll(STORES.SENDER_KEYS),
    getAllKeys: () => getAllKeys(STORES.SENDER_KEYS),
    clear: () => clearStore(STORES.SENDER_KEYS),
    bulkPut: (items) => bulkPut(STORES.SENDER_KEYS, items),
  },
};
