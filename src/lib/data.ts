import type { ShiftReport, Task } from './types';

export const tasks: Task[] = [
  { id: 'task-1', text: 'Clean front entrance and welcome mat' },
  { id: 'task-2', text: 'Wipe down all tables and chairs', isCritical: true },
  { id: 'task-3', text: 'Restock napkins and condiments' },
  { id: 'task-4', text: 'Clean and sanitize restrooms', isCritical: true },
  { id: 'task-5', text: 'Empty all trash bins and replace liners' },
  { id: 'task-6', text: 'Sweep and mop all floors' },
  { id: 'task-7', text: 'Check and report any equipment malfunctions' },
];

export const reports: ShiftReport[] = [
  {
    id: 'report-001',
    staffName: 'Jane Doe',
    shiftDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    completedTasks: ['task-1', 'task-2', 'task-3', 'task-4', 'task-5', 'task-6', 'task-7'],
    uploadedPhotos: [
      'https://picsum.photos/600/400?random=1',
      'https://picsum.photos/600/400?random=2',
      'https://picsum.photos/600/400?random=3',
    ],
    issues: 'The coffee machine in the break room was leaking again. Placed a bucket underneath.',
  },
  {
    id: 'report-002',
    staffName: 'John Smith',
    shiftDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    completedTasks: ['task-1', 'task-3', 'task-5', 'task-6'],
    uploadedPhotos: [
        'https://picsum.photos/600/400?random=4',
        'https://picsum.photos/600/400?random=5',
    ],
    issues: 'Ran out of cleaning spray for the restrooms. Had to use soap and water.',
  },
  {
    id: 'report-003',
    staffName: 'Emily White',
    shiftDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    completedTasks: ['task-1', 'task-2', 'task-3', 'task-4', 'task-5', 'task-6', 'task-7'],
    uploadedPhotos: [
        'https://picsum.photos/600/400?random=6',
        'https://picsum.photos/600/400?random=7',
        'https://picsum.photos/600/400?random=8',
        'https://picsum.photos/600/400?random=9',
    ],
    issues: null,
  },
];
