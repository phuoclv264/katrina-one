

import type { Timestamp } from 'firebase/firestore';

export type Staff = {
  pin: string;
  name: string;
};

export type Task = {
  id: string;
  text: string;
  isCritical?: boolean;
};

export type TaskSection = {
  title: string;
  tasks: Task[];
}

export type Shift = {
  name:string;
  sections: TaskSection[];
};

export type TasksByShift = {
  [key: string]: Shift;
};

export type CompletionRecord = {
  timestamp: string;
  photos: string[]; // Can be data URIs (local) or Firebase Storage URLs (synced)
};

export type TaskCompletion = {
  [taskId:string]: CompletionRecord[];
};

// Represents a report, either locally or on Firestore
export type ShiftReport = {
  id: string; // Composite key for local, Firestore doc ID for remote
  userId: string;
  staffName: string;
  shiftKey: string;
  
  // Status tracking
  status: 'ongoing' | 'submitted'; // 'submitted' is final
  
  // Timestamps
  date: string; // YYYY-MM-DD
  startedAt: string | Timestamp; // ISO string locally, Timestamp on server
  submittedAt?: string | Timestamp; // ISO string, set on submission
  lastUpdated: string | Timestamp; // ISO string locally, Timestamp on server
  
  // Report data
  completedTasks: TaskCompletion;
  issues: string | null;
  
  // Photos that have been uploaded and have a firebase URL
  // This is mainly for the manager's view and for cleanup.
  uploadedPhotos: string[];
};

    