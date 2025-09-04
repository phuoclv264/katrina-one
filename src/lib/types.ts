
import type { Timestamp } from 'firebase/firestore';

export type Staff = {
  pin: string;
  name: string;
};

export type Task = {
  id: string;
  text: string;
  isCritical?: boolean;
  type: 'photo';
};

// Type for AI-parsed server tasks
export type ParsedServerTask = Omit<Task, 'id' | 'type'>;

export type ComprehensiveTask = {
  id: string;
  text: string;
  type: 'photo' | 'boolean' | 'opinion';
}

// Type for AI-parsed comprehensive tasks
export type ParsedComprehensiveTask = Omit<ComprehensiveTask, 'id'>;


export type TaskSection = {
  title: string;
  tasks: Task[];
}

export type ComprehensiveTaskSection = {
  title: string;
  tasks: ComprehensiveTask[];
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
  value?: boolean; // For boolean tasks (Yes/No)
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

// --- Inventory Types ---

export type InventoryItem = {
    id: string;
    name: string;
    unit: string;
    minStock: number;
    orderSuggestion: string; // e.g., "4" or "5kg"
};

// Type for AI-parsed items before they get a real ID
export type ParsedInventoryItem = Omit<InventoryItem, 'id'>;

export type InventoryStockLevels = {
    [itemId: string]: number; // current stock
};

export type InventoryOrderItem = {
    itemId: string;
    quantityToOrder: string;
};

export type InventoryOrderSuggestion = {
    summary: string;
    itemsToOrder: InventoryOrderItem[];
};

export type InventoryReport = {
    id: string; // inventory-report-{userId}-{date}
    userId: string;
    staffName: string;
    date: string; // YYYY-MM-DD
    status: 'ongoing' | 'submitted';
    stockLevels: InventoryStockLevels;
    suggestions: InventoryOrderSuggestion | null;
    lastUpdated: string | Timestamp;
    submittedAt?: string | Timestamp;
};
