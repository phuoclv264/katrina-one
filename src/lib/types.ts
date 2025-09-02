
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
  name: string;
  sections: TaskSection[];
};

export type TasksByShift = {
  [key: string]: Shift;
};

export type CompletionRecord = {
  timestamp: string;
  photos: string[]; // URLs of photos in Firebase Storage
};

export type TaskCompletion = {
  [taskId:string]: CompletionRecord[];
};

export type ShiftReport = {
  id: string;
  staffName: string;
  // shiftDate is now handled by submittedAt
  submittedAt: string | Timestamp; // ISO string for the submission time, or Firestore Timestamp
  completedTasks: TaskCompletion;
  uploadedPhotos: string[];
  issues: string | null;
  shiftKey: string;
};
