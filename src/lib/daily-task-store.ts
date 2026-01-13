'use client';

import { db } from './firebase';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { format, addMonths, startOfMonth } from 'date-fns';
import type { DailyTask, DailyTaskReport, DailyTaskTargetMode, MediaItem, SimpleUser, UserRole } from './types';
import { uploadMedia } from './data-store-helpers';

const DAILY_TASKS_COLLECTION = 'daily_tasks';
const DAILY_TASK_REPORTS_COLLECTION = 'daily_task_reports';

const formatDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

const getMonthBounds = (date: Date) => {
  const start = startOfMonth(date);
  const next = startOfMonth(addMonths(date, 1));
  return {
    startKey: format(start, 'yyyy-MM-dd'),
    endKey: format(next, 'yyyy-MM-dd'),
  };
};

type CreateDailyTaskInput = {
  title: string;
  description: string;
  assignedDate: string; // YYYY-MM-DD
  targetMode: DailyTaskTargetMode;
  targetRoles?: UserRole[];
  targetUserIds?: string[];
  media?: MediaItem[];
  createdBy: SimpleUser;
  createdByRole: UserRole;
};

type SubmitDailyTaskReportInput = {
  task: DailyTask;
  reporter: SimpleUser;
  content?: string;
  media?: MediaItem[];
};

type ApproveReportInput = {
  task: DailyTask;
  report: DailyTaskReport;
  manager: SimpleUser;
  managerNote?: string;
};

export function subscribeToDailyTasksForDate(
  date: Date,
  callback: (tasks: DailyTask[]) => void,
): () => void {
  const dateKey = formatDateKey(date);
  const q = query(
    collection(db, DAILY_TASKS_COLLECTION),
    where('assignedDate', '>=', dateKey),
    where('assignedDate', '<', `${dateKey}z`),
    orderBy('assignedDate', 'desc'),
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as DailyTask));
    callback(tasks);
  }, (error) => {
    console.warn('[Firestore Read Error] Could not read daily tasks:', error.code);
    callback([]);
  });

  return unsubscribe;
}

export function subscribeToDailyTasksForMonth(
  month: Date,
  callback: (tasks: DailyTask[]) => void,
): () => void {
  const { startKey, endKey } = getMonthBounds(month);
  const q = query(
    collection(db, DAILY_TASKS_COLLECTION),
    where('assignedDate', '>=', startKey),
    where('assignedDate', '<', endKey),
    orderBy('assignedDate', 'desc'),
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as DailyTask));
    callback(tasks);
  }, (error) => {
    console.warn('[Firestore Read Error] Could not read monthly daily tasks:', error.code);
    callback([]);
  });

  return unsubscribe;
}

export function subscribeToDailyTaskReportsForDate(
  date: Date,
  callback: (reports: DailyTaskReport[]) => void,
): () => void {
  const dateKey = formatDateKey(date);
  const q = query(
    collection(db, DAILY_TASK_REPORTS_COLLECTION),
    where('assignedDate', '>=', dateKey),
    where('assignedDate', '<', `${dateKey}z`),
    orderBy('assignedDate', 'desc'),
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const reports = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as DailyTaskReport));
    callback(reports);
  }, (error) => {
    console.warn('[Firestore Read Error] Could not read daily task reports:', error.code);
    callback([]);
  });

  return unsubscribe;
}

export function subscribeToDailyTaskReportsForMonth(
  month: Date,
  callback: (reports: DailyTaskReport[]) => void,
): () => void {
  const { startKey, endKey } = getMonthBounds(month);
  const q = query(
    collection(db, DAILY_TASK_REPORTS_COLLECTION),
    where('assignedDate', '>=', startKey),
    where('assignedDate', '<', endKey),
    orderBy('assignedDate', 'desc'),
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const reports = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as DailyTaskReport));
    callback(reports);
  }, (error) => {
    console.warn('[Firestore Read Error] Could not read monthly daily task reports:', error.code);
    callback([]);
  });

  return unsubscribe;
}

export async function createDailyTask(input: CreateDailyTaskInput): Promise<DailyTask> {
  const taskRef = doc(collection(db, DAILY_TASKS_COLLECTION));
  const uploadPath = `daily-tasks/${input.assignedDate}/${taskRef.id}/instructions`;
  const media = input.media && input.media.length > 0 ? await uploadMedia(input.media, uploadPath) : undefined;

  const taskData: any = {
    id: taskRef.id,
    title: input.title.trim(),
    description: input.description.trim(),
    assignedDate: input.assignedDate,
    targetMode: input.targetMode,
    createdBy: input.createdBy,
    createdByRole: input.createdByRole,
    status: 'open',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (input.targetMode === 'roles') {
    taskData.targetRoles = input.targetRoles || [];
  } else if (input.targetMode === 'users') {
    taskData.targetUserIds = input.targetUserIds || [];
  }

  if (media && media.length > 0) {
    taskData.media = media;
  }

  const task = taskData as DailyTask;

  await setDoc(taskRef, task);
  return task;
}

export async function submitDailyTaskReport(input: SubmitDailyTaskReportInput): Promise<DailyTaskReport> {
  const reportRef = doc(collection(db, DAILY_TASK_REPORTS_COLLECTION));
  const uploadPath = `daily-tasks/${input.task.id}/reports/${reportRef.id}`;
  const media = input.media && input.media.length > 0 ? await uploadMedia(input.media, uploadPath) : undefined;

  const report: DailyTaskReport = {
    id: reportRef.id,
    taskId: input.task.id,
    taskTitle: input.task.title,
    assignedDate: input.task.assignedDate,
    reporter: input.reporter,
    content: input.content?.trim() || '',
    media,
    status: 'submitted',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(reportRef, report);
  await updateDoc(doc(db, DAILY_TASKS_COLLECTION, input.task.id), {
    status: 'in_review',
    updatedAt: serverTimestamp(),
  });

  return report;
}

const notifyOwnersAboutReport = async (task: DailyTask, report: DailyTaskReport, manager: SimpleUser) => {
  const ownerSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'Chủ nhà hàng')));
  const ownerIds = ownerSnapshot.docs.map((d) => d.id);
  if (!ownerIds.length) return;

  await addDoc(collection(db, 'notifications'), {
    type: 'new_daily_task_report',
    messageTitle: `Báo cáo giao việc: ${task.title}`,
    messageBody: `${manager.userName} đã duyệt báo cáo của ${report.reporter.userName}.`,
    recipientUids: ownerIds,
    createdAt: serverTimestamp(),
    payload: {
      notificationType: 'new_daily_task_report',
      taskId: task.id,
      taskTitle: task.title,
      assignedDate: task.assignedDate,
      reportId: report.id,
      url: `/daily-assignments?date=${task.assignedDate}&highlight=${report.id}`,
    },
  });
};

export async function approveDailyTaskReport({ task, report, manager, managerNote }: ApproveReportInput): Promise<void> {
  const reportRef = doc(db, DAILY_TASK_REPORTS_COLLECTION, report.id);
  await updateDoc(reportRef, {
    status: 'manager_approved',
    managerNote: managerNote ?? report.managerNote ?? '',
    reviewedBy: manager,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, DAILY_TASKS_COLLECTION, task.id), {
    status: 'completed',
    completedBy: manager,
    completedAt: serverTimestamp(),
    summaryNote: managerNote ?? task.summaryNote ?? '',
    updatedAt: serverTimestamp(),
  });

  await notifyOwnersAboutReport(task, report, manager);
}

export async function rejectDailyTaskReport(reportId: string, reason?: string): Promise<void> {
  const reportRef = doc(db, DAILY_TASK_REPORTS_COLLECTION, reportId);
  await updateDoc(reportRef, {
    status: 'rejected',
    managerNote: reason || '',
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function reopenDailyTask(taskId: string): Promise<void> {
  await updateDoc(doc(db, DAILY_TASKS_COLLECTION, taskId), {
    status: 'open',
    completedAt: null,
    completedBy: null,
    updatedAt: serverTimestamp(),
  });
}
