

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

export type AppSettings = {
  isRegistrationEnabled: boolean;
};

export type Task = {
  id: string;
  text: string;
  isCritical?: boolean;
  type: 'photo' | 'boolean' | 'opinion';
};

// Type for AI-parsed server tasks
export type ParsedServerTask = Omit<Task, 'id'> & {
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
    category: string;
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

// --- Violation Logging Types ---
export type ViolationCategory = string;

export type ViolationUser = {
  id: string;
  name: string;
}

export type Violation = {
  id: string;
  content: string;
  category: ViolationCategory;
  users: ViolationUser[]; // User who committed the violation
  reporterId: string; // User who reported the violation
  reporterName: string;
  photos: string[];
  createdAt: string | Timestamp;
  lastModified?: string | Timestamp;
  penaltyPhotos?: string[];
  penaltySubmittedAt?: string | Timestamp;
};

// --- Summary Types ---
export type DailySummary = {
    id?: string; // date YYYY-MM-DD
    summary: string;
    generatedAt: string | Timestamp;
}

// --- Schedule Types ---
export type TimeSlot = {
  start: string; // "HH:mm"
  end: string;
};

export type ShiftTemplate = {
  id: string;
  label: string;
  role: UserRole | 'Bất kỳ';
  timeSlot: TimeSlot;
  applicableDays: number[]; // 0 for Sun, 1 for Mon, ..., 6 for Sat
};

export type Availability = {
  userId: string;
  userName: string;
  date: string; // YYYY-MM-DD
  availableSlots: TimeSlot[];
};

export type AssignedUser = {
  userId: string;
  userName: string;
};

export type PassRequest = {
  requestingUser: AssignedUser;
  status: 'pending' | 'taken';
  takenBy?: AssignedUser;
  timestamp: string | Timestamp;
};

export type AssignedShift = {
  id: string; // Unique ID for this specific shift instance in the schedule
  templateId: string;
  date: string; // YYYY-MM-DD
  label: string;
  role: UserRole | 'Bất kỳ';
  timeSlot: TimeSlot;
  assignedUsers: AssignedUser[];
  passRequests?: PassRequest[];
};

export type Schedule = {
  weekId: string; // e.g., "2024-W28"
  status: 'draft' | 'proposed' | 'published';
  availability: Availability[];
  shifts: AssignedShift[];
};
