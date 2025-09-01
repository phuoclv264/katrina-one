
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
  photos: string[];
};

export type TaskCompletion = {
  [taskId:string]: CompletionRecord[];
};

export type ShiftReport = {
  id: string;
  staffName: string;
  shiftDate: string;
  submittedAt: string; // ISO string for the submission time
  completedTasks: TaskCompletion;
  uploadedPhotos: string[];
  issues: string | null;
  shiftKey: string;
  taskPhotos?: { [taskId: string]: string[] }; // Can be deprecated
};
