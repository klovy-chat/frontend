export const E2E_DB_NAME = "klovy-e2e-v1";
export const E2E_DB_VERSION = 2;

export type E2eStoreName =
  | "meta"
  | "preKeys"
  | "signedPreKeys"
  | "sessions"
  | "channelSenderKeys";

const STORE_NAMES: E2eStoreName[] = [
  "meta",
  "preKeys",
  "signedPreKeys",
  "sessions",
  "channelSenderKeys",
];

let openPromise: Promise<IDBDatabase> | null = null;

function ensureStores(db: IDBDatabase): void {
  for (const name of STORE_NAMES) {
    if (!db.objectStoreNames.contains(name)) {
      db.createObjectStore(name);
    }
  }
}

export function openE2eDb(): Promise<IDBDatabase> {
  if (openPromise) return openPromise;

  openPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(E2E_DB_NAME, E2E_DB_VERSION);

    req.onupgradeneeded = () => {
      ensureStores(req.result);
    };

    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        openPromise = null;
      };
      resolve(db);
    };

    req.onerror = () => {
      openPromise = null;
      reject(req.error ?? new Error("E2E_IDB_OPEN_FAILED"));
    };

    req.onblocked = () => {
      openPromise = null;
      reject(new Error("E2E_IDB_BLOCKED"));
    };
  });

  return openPromise;
}

export async function idbGet<T>(
  store: E2eStoreName,
  key: string,
): Promise<T | undefined> {
  const db = await openE2eDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut(
  store: E2eStoreName,
  key: string,
  value: unknown,
): Promise<void> {
  const db = await openE2eDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDelete(store: E2eStoreName, key: string): Promise<void> {
  const db = await openE2eDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
