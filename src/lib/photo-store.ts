
import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'PhotoCacheDB';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

interface PhotoDB extends DBSchema {
  [STORE_NAME]: {
    key: string;
    value: {
      id: string;
      blob: Blob;
      timestamp: number;
    };
    indexes: { 'timestamp': number };
  };
}

let dbPromise: Promise<IDBPDatabase<PhotoDB>> | null = null;

const getDb = (): Promise<IDBPDatabase<PhotoDB>> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error("IndexedDB can only be used in the browser."));
  }
  if (!dbPromise) {
    dbPromise = openDB<PhotoDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp');
        }
      },
    });
  }
  return dbPromise;
};


export const photoStore = {
  async addPhoto(id: string, blob: Blob): Promise<string> {
    const db = await getDb();
    await db.put(STORE_NAME, { id, blob, timestamp: Date.now() });
    return id;
  },

  async getPhoto(id: string): Promise<Blob | undefined> {
    const db = await getDb();
    const result = await db.get(STORE_NAME, id);
    return result?.blob;
  },
  
  async getPhotosAsUrls(ids: string[]): Promise<Map<string, string>> {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const results = await Promise.all(ids.map(id => store.get(id)));
    
    const urlMap = new Map<string, string>();
    results.forEach(result => {
        if(result) {
            urlMap.set(result.id, URL.createObjectURL(result.blob));
        }
    });

    await tx.done;
    return urlMap;
  },

  async deletePhoto(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(STORE_NAME, id);
  },

  async deletePhotos(ids: string[]): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await Promise.all(ids.map(id => tx.store.delete(id)));
    await tx.done;
  },
  
  /**
   * Cleans up photos from previous days to save space.
   */
  async cleanupOldPhotos(): Promise<void> {
    try {
      const db = await getDb();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startOfToday = today.getTime();

      const tx = db.transaction(STORE_NAME, 'readwrite');
      const index = tx.store.index('timestamp');
      let cursor = await index.openCursor(IDBKeyRange.upperBound(startOfToday, true)); // Get all items *before* today

      while (cursor) {
        console.log(`Deleting old photo: ${cursor.value.id}`);
        cursor.delete();
        cursor = await cursor.continue();
      }

      await tx.done;
    } catch (error) {
       console.error("IndexedDB is not available or cleanup failed:", error);
    }
  }
};
