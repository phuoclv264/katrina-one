
'use client';

import type { ShiftReport, TasksByShift, Task, Staff, TaskCompletion } from './types';
import { tasksByShift as initialTasksByShift, reports as initialReports, staff as initialStaff } from './data';

const isBrowser = typeof window !== 'undefined';

function getFromStorage<T>(key: string, initialValue: T): T {
    if (!isBrowser) return initialValue;
    try {
        const storedValue = localStorage.getItem(key);
        if (storedValue) {
            return JSON.parse(storedValue);
        }
    } catch (error) {
        console.error(`Failed to parse ${key} from localStorage`, error);
    }
    // If nothing in localStorage, initialize it with initial data
    localStorage.setItem(key, JSON.stringify(initialValue));
    return initialValue;
}

// We will use these as a reactive store.
// In a real app, you'd use a state management library or a backend API.
let tasks: TasksByShift = getFromStorage('tasksByShift', initialTasksByShift);
let reports: ShiftReport[] = getFromStorage('shiftReports', initialReports);
let staff: Staff[] = getFromStorage('staff', initialStaff);
// Daily state for task completions
let dailyCompletions: Record<string, TaskCompletion> = getFromStorage('dailyCompletions', {});


const listeners: (() => void)[] = [];

function notifyListeners() {
  listeners.forEach(listener => listener());
}

function saveToStorage<T>(key: string, value: T) {
    if (isBrowser) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error(`Failed to save ${key} to localStorage`, error);
        }
    }
}

// Clear daily data if the date has changed
function checkAndClearDailyData() {
    if (!isBrowser) return;
    const today = new Date().toISOString().split('T')[0];
    const lastVisitDate = localStorage.getItem('lastVisitDate');

    if (lastVisitDate !== today) {
        localStorage.setItem('dailyCompletions', JSON.stringify({}));
        dailyCompletions = {};
        localStorage.setItem('lastVisitDate', today);
    }
}

checkAndClearDailyData();

export const dataStore = {
  getTasks: (): TasksByShift => tasks,
  getReports: (): ShiftReport[] => reports,
  getStaff: (): Staff[] => staff,

  getDailyCompletions: (key: string): TaskCompletion | undefined => {
      checkAndClearDailyData();
      return dailyCompletions[key];
  },

  updateDailyCompletions: (key: string, completion: TaskCompletion) => {
      dailyCompletions[key] = completion;
      saveToStorage('dailyCompletions', dailyCompletions);
      notifyListeners(); // Notify if you have components listening to daily changes
  },
  
  updateTasks: (newTasks: TasksByShift) => {
    tasks = newTasks;
    saveToStorage('tasksByShift', tasks);
    notifyListeners();
  },

  addOrUpdateReport: (newReportData: Omit<ShiftReport, 'id' | 'shiftDate' | 'submittedAt'>) => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const existingReportIndex = reports.findIndex(
        r => r.shiftDate === today && 
             r.shiftKey === newReportData.shiftKey &&
             r.staffName === newReportData.staffName
    );

    if (existingReportIndex !== -1) {
        // Update existing report
        const existingReport = reports[existingReportIndex];
        reports[existingReportIndex] = {
            ...existingReport,
            ...newReportData,
            submittedAt: now.toISOString(), // Update submission time
        };
    } else {
        // Add new report
        const reportToAdd: ShiftReport = {
            ...newReportData,
            id: `report-${now.getTime()}`,
            shiftDate: today,
            submittedAt: now.toISOString(),
        };
        reports = [reportToAdd, ...reports];
    }
    
    saveToStorage('shiftReports', reports);
    notifyListeners();
  },

  subscribe: (listener: () => void) => {
    listeners.push(listener);
    // Initial check when a component subscribes
    checkAndClearDailyData();
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }
};
