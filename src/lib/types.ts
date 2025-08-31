
export type Task = {
  id: string;
  text: string;
  isCritical?: boolean;
  timeSlots?: boolean; // Changed to boolean to indicate it's a timestamp-based task
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

export type TaskCompletion = {
  [taskId: string]: boolean | string[]; // boolean for simple tasks, string[] for timestamps
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
  taskPhotos?: { [taskId: string]: string[] }; // Optional: associates photos with tasks
};
