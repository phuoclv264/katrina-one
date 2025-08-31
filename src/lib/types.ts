export type Task = {
  id: string;
  text: string;
  isCritical?: boolean;
  timeSlots?: string[];
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
  [taskId: string]: boolean | { [timeSlot: string]: boolean };
};

export type ShiftReport = {
  id: string;
  staffName: string;
  shiftDate: string;
  completedTasks: TaskCompletion;
  uploadedPhotos: string[];
  issues: string | null;
  shiftKey: string;
};
