'use client';

import { openDB, type IDBPDatabase, type DBSchema } from 'idb';

const DB_NAME = 'GenericKeyValDB';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

interface KeyValDB extends DBSchema {
  [STORE_NAME]: {
    key: IDBValidKey;
    value: any;
  };
}

let dbPromise: Promise<IDBPDatabase<KeyValDB>> | null = null;

const getDb = (): Promise<IDBPDatabase<KeyValDB>> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error("IndexedDB can only be used in the browser."));
  }
  if (!dbPromise) {
    dbPromise = openDB<KeyValDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
};

export async function set(key: IDBValidKey, value: any): Promise<void> {
  const start = Date.now();
  try {
    console.log('[idb-keyval] set start', { key, value });
    await (await getDb()).put(STORE_NAME, value, key);
    console.log('[idb-keyval] set success', { key, durationMs: Date.now() - start });
  } catch (error) {
    console.error('[idb-keyval] set error', { key, error });
    throw error;
  }
}

export async function get<T = any>(key: IDBValidKey): Promise<T | undefined> {
  return (await getDb()).get(STORE_NAME, key);
}

export async function del(key: IDBValidKey): Promise<void> {
  (await getDb()).delete(STORE_NAME, key);
}

export async function keys(): Promise<IDBValidKey[]> {
  return (await getDb()).getAllKeys(STORE_NAME);
}