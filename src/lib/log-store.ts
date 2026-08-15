'use client';

import { addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, startAfter, writeBatch } from 'firebase/firestore';
import { db, auth } from './firebase';
import type { FirestoreError } from 'firebase/firestore';

export type AppLogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug' | 'event';

export type AppLogEntry = {
  id: string;
  timestamp: string;
  level: AppLogLevel;
  message: string;
  details?: string;
  source?: 'local' | 'server';
  userId?: string | null;
  userAgent?: string | null;
};

const MAX_LOG_ENTRIES = 300;
const logs: AppLogEntry[] = [];
const subscribers = new Set<() => void>();

const notifySubscribers = () => {
  subscribers.forEach((callback) => callback());
};

const createEntryId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const addAppLog = (entry: Omit<AppLogEntry, 'id' | 'timestamp' | 'source'>) => {
  const newEntry: AppLogEntry = {
    id: createEntryId(),
    timestamp: new Date().toISOString(),
    source: 'local',
    ...entry,
  };

  logs.push(newEntry);
  if (logs.length > MAX_LOG_ENTRIES) {
    logs.splice(0, logs.length - MAX_LOG_ENTRIES);
  }
  notifySubscribers();
};

export const getAppLogs = (): AppLogEntry[] => {
  return [...logs].reverse();
};

export const clearAppLogs = () => {
  logs.length = 0;
  notifySubscribers();
};

export const subscribeAppLogs = (callback: () => void) => {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
};

const docToAppLogEntry = (docData: any, id: string): AppLogEntry => {
  const createdAt = docData.createdAt;
  const timestamp = createdAt && typeof createdAt?.toDate === 'function'
    ? createdAt.toDate().toISOString()
    : docData.timestamp || new Date().toISOString();

  return {
    id,
    timestamp,
    level: docData.level as AppLogLevel,
    message: docData.message || '',
    details: docData.details || undefined,
    source: 'server',
    userId: docData.userId || null,
    userAgent: docData.userAgent || null,
  };
};

export const saveAppLogToServer = async (entry: AppLogEntry): Promise<void> => {
  if (!db) return;

  console.log('Saving log to server:', entry);

  try {
    await addDoc(collection(db, 'appLogs'), {
      level: entry.level,
      message: entry.message,
      details: entry.details || null,
      timestamp: entry.timestamp,
      createdAt: serverTimestamp(),
      userId: auth?.currentUser?.uid || null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      pageUrl: typeof window !== 'undefined' ? window.location.href : null,
    });
  } catch (_error) {
    console.log('Failed to save log to server:', _error);
    // intentionally swallow server persistence failures to avoid recursive logging
  }
};

export const fetchAppLogsFromServer = async (limitCount = 100): Promise<AppLogEntry[]> => {
  if (!db) return [];

  try {
    const logsQuery = query(collection(db, 'appLogs'), orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(logsQuery);
    return snapshot.docs.map((doc) => docToAppLogEntry(doc.data(), doc.id));
  } catch (_error) {
    return [];
  }
};

export const deleteAppLogFromServer = async (logId: string): Promise<boolean> => {
  if (!db) return false;

  try {
    await deleteDoc(doc(db, 'appLogs', logId));
    return true;
  } catch (_error) {
    return false;
  }
};

export const deleteAllAppLogsFromServer = async (): Promise<boolean> => {
  if (!db) return false;

  try {
    let nextQuery = query(collection(db, 'appLogs'), orderBy('createdAt', 'desc'), limit(500));
    while (true) {
      const snapshot = await getDocs(nextQuery);
      if (snapshot.empty) {
        return true;
      }
      const batch = writeBatch(db);
      snapshot.docs.forEach((logDoc) => batch.delete(doc(db, 'appLogs', logDoc.id)));
      await batch.commit();
      if (snapshot.size < 500) {
        return true;
      }
      const last = snapshot.docs[snapshot.docs.length - 1];
      nextQuery = query(collection(db, 'appLogs'), orderBy('createdAt', 'desc'), startAfter(last), limit(500));
    }
  } catch (_error) {
    return false;
  }
};
