
'use client';

import type { ShiftReport, TasksByShift, Task } from './types';
import { tasksByShift as initialTasksByShift, reports as initialReports } from './data';

const isBrowser = typeof window !== 'undefined';

function getInitialTasks(): TasksByShift {
  if (!isBrowser) return initialTasksByShift;
  try {
    const storedTasks = localStorage.getItem('tasksByShift');
    if (storedTasks) {
      return JSON.parse(storedTasks);
    }
  } catch (error) {
    console.error("Failed to parse tasks from localStorage", error);
  }
  // If nothing in localStorage, initialize it with data from data.ts
  localStorage.setItem('tasksByShift', JSON.stringify(initialTasksByShift));
  return initialTasksByShift;
}

function getInitialReports(): ShiftReport[] {
    if (!isBrowser) return initialReports;
    try {
        const storedReports = localStorage.getItem('shiftReports');
        if (storedReports) {
            return JSON.parse(storedReports);
        }
    } catch (error) {
        console.error("Failed to parse reports from localStorage", error);
    }
    // If nothing in localStorage, initialize it with data from data.ts
    localStorage.setItem('shiftReports', JSON.stringify(initialReports));
    return initialReports;
}


// We will use these as a reactive store.
// In a real app, you'd use a state management library or a backend API.
let tasks = getInitialTasks();
let reports = getInitialReports();
const listeners: (() => void)[] = [];

function notifyListeners() {
  listeners.forEach(listener => listener());
}

export const dataStore = {
  getTasks: (): TasksByShift => tasks,
  getReports: (): ShiftReport[] => reports,
  
  updateTasks: (newTasks: TasksByShift) => {
    tasks = newTasks;
    if (isBrowser) {
        try {
            localStorage.setItem('tasksByShift', JSON.stringify(tasks));
        } catch (error) {
            console.error("Failed to save tasks to localStorage", error);
        }
    }
    notifyListeners();
  },

  addReport: (newReport: Omit<ShiftReport, 'id' | 'shiftDate' | 'submittedAt'>) => {
    const now = new Date();
    const reportToAdd: ShiftReport = {
        ...newReport,
        id: `report-${now.getTime()}`,
        shiftDate: now.toISOString().split('T')[0],
        submittedAt: now.toISOString(),
    };
    reports = [reportToAdd, ...reports];
     if (isBrowser) {
        try {
            localStorage.setItem('shiftReports', JSON.stringify(reports));
        } catch (error) {
            console.error("Failed to save reports to localStorage", error);
        }
    }
    notifyListeners();
  },

  subscribe: (listener: () => void) => {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }
};
