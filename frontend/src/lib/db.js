const DB_NAME = "kivo";
const DB_VERSION = 1;

const openDb = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains("profile")) db.createObjectStore("profile", { keyPath: "id" });
    if (!db.objectStoreNames.contains("kits")) db.createObjectStore("kits", { keyPath: "id" });
    if (!db.objectStoreNames.contains("activity")) {
      const store = db.createObjectStore("activity", { keyPath: "id" });
      store.createIndex("createdAt", "createdAt");
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const transaction = async (storeName, mode, action) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = action(store);
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
  });
};

export const db = {
  profile: {
    get: () => transaction("profile", "readonly", (store) => store.get("current")),
    save: (profile) => transaction("profile", "readwrite", (store) => store.put({ id: "current", ...profile }))
  },
  kits: {
    all: () => transaction("kits", "readonly", (store) => store.getAll()),
    get: (id) => transaction("kits", "readonly", (store) => store.get(id)),
    save: (kit) => transaction("kits", "readwrite", (store) => store.put(kit)),
    remove: (id) => transaction("kits", "readwrite", (store) => store.delete(id))
  },
  activity: {
    all: () => transaction("activity", "readonly", (store) => store.getAll()),
    add: (item) => transaction("activity", "readwrite", (store) => store.put({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...item }))
  }
};
