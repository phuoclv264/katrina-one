

import type { Timestamp } from 'firebase/firestore';

export type Staff = {
  pin: string;
  name: string;
};

export type UserRole = 'Phục vụ' | 'Pha chế' | 'Quản lý' | 'Chủ nhà hàng';

export type ManagedUser = {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  notes?: string;
};

export type Task = {
  id: string;
  text: string;
  isCritical?: boolean;
  type: 'photo';
};

// Type for AI-parsed server tasks
export type ParsedServerTask = Omit<Task, 'id' | 'type'> & {
    text: string;
    isCritical: boolean;
};


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
  photoIds?: string[]; // Temp IDs for photos in IndexedDB
  photos?: string[]; // Permanent Firebase Storage URLs
  value?: boolean; // For boolean tasks (Yes/No)
  opinion?: string; // For opinion tasks
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
};

// --- Inventory Types ---

export type InventoryItem = {
    id: string;
    name: string;
    supplier: string;
    unit: string;
    minStock: number;
    orderSuggestion: string; // e.g., "4" or "5kg"
    requiresPhoto?: boolean;
};

export type Suppliers = string[];

// Type for AI-parsed items before they get a real ID
export type ParsedInventoryItem = Omit<InventoryItem, 'id'>;

export type UpdateInventoryItemsOutput = {
    items: InventoryItem[];
};

export type InventoryStockRecord = {
  stock: number | string;
  photoIds?: string[];
  photos?: string[];
};

export type InventoryStockLevels = {
    [itemId: string]: InventoryStockRecord;
};

export type InventoryOrderItem = {
    itemId: string;
    quantityToOrder: string;
};

export type OrderBySupplier = {
  supplier: string;
  itemsToOrder: InventoryOrderItem[];
}

export type InventoryOrderSuggestion = {
    summary: string;
    ordersBySupplier: OrderBySupplier[];
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

// --- Error Logging Types ---
export type AppError = {
  id?: string;
  message: string;
  source: string; // e.g., component name or function name
  stack?: string;
  userId?: string;
  userEmail?: string;
  timestamp?: string | Timestamp;
};
