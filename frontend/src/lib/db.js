const DB_NAME = 'SecureChannelX_DB';
const DB_VERSION = 1;
const STORES = {
    KEYS: 'keys',
    SESSIONS: 'sessions',
    SENDER_KEYS: 'sender_keys'
};

export const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
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
};

const performTransaction = (storeName, mode, callback) => {
    return initDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);
            const request = callback(store);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    });
};

export const db = {
    keys: {
        put: (id, data) => performTransaction(STORES.KEYS, 'readwrite', store => store.put({ id, ...data })),
        get: (id) => performTransaction(STORES.KEYS, 'readonly', store => store.get(id)),
        delete: (id) => performTransaction(STORES.KEYS, 'readwrite', store => store.delete(id)),
        getAll: () => performTransaction(STORES.KEYS, 'readonly', store => store.getAll())
    },
    sessions: {
        put: (id, data) => performTransaction(STORES.SESSIONS, 'readwrite', store => store.put({ id, ...data })),
        get: (id) => performTransaction(STORES.SESSIONS, 'readonly', store => store.get(id)),
        delete: (id) => performTransaction(STORES.SESSIONS, 'readwrite', store => store.delete(id))
    },
    senderKeys: {
        put: (id, data) => performTransaction(STORES.SENDER_KEYS, 'readwrite', store => store.put({ id, ...data })),
        get: (id) => performTransaction(STORES.SENDER_KEYS, 'readonly', store => store.get(id)),
        delete: (id) => performTransaction(STORES.SENDER_KEYS, 'readwrite', store => store.delete(id))
    }
};
