export type Task = {
  id: string;
  text: string;
  isCritical?: boolean;
};

export type ShiftReport = {
  id: string;
  staffName: string;
  shiftDate: string;
  completedTasks: Task['id'][];
  uploadedPhotos: string[];
  issues: string | null;
};
