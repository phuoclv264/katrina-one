

import type { Timestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';

export type Staff = {
  pin: string;
  name: string;
};

export type UserRole = 'Phục vụ' | 'Pha chế' | 'Quản lý' | 'Chủ nhà hàng' | 'Thu ngân';

export type ManagedUser = {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  secondaryRoles?: UserRole[];
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
    unitPrice: number; // Current price per unit
    stock: number; // Current stock quantity
    orderSuggestion: string; // e.g., "4" or "5kg"
    requiresPhoto?: boolean;
    isImportant?: boolean; // New field for required stock input
    dataType: 'number' | 'list';
    listOptions?: string[];
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

export type OrderItem = {
    itemId: string;
    quantityToOrder: string;
};

export type OrderBySupplier = {
  supplier: string;
  itemsToOrder: OrderItem[];
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

export type ViolationComment = {
  id: string;
  commenterId: string;
  commenterName: string;
  text: string;
  photos: string[];
  createdAt: string | Timestamp;
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
  isFlagged?: boolean;
  isPenaltyWaived?: boolean; // New field for penalty waiver
  comments?: ViolationComment[];
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
  minUsers: number;
};

export type AssignedUser = {
  userId: string;
  userName: string;
};

export type AssignedShift = {
  id: string; // Unique ID for this specific shift instance in the schedule
  templateId: string;
  date: string; // YYYY-MM-DD
  label: string;
  role: UserRole | 'Bất kỳ';
  timeSlot: TimeSlot;
  assignedUsers: AssignedUser[];
  minUsers: number;
};

export type Schedule = {
  weekId: string; // e.g., "2024-W28"
  status: 'draft' | 'proposed' | 'published';
  availability: Availability[];
  shifts: AssignedShift[];
};

export type Availability = {
  userId: string;
  userName: string;
  date: string; // YYYY-MM-DD
  availableSlots: TimeSlot[];
};


// --- Notification System Types ---

export type NotificationStatus = 'pending' | 'pending_approval' | 'resolved' | 'cancelled';
export type NotificationType = 'pass_request';

export type PassRequestPayload = {
  weekId: string;
  shiftId: string;
  shiftLabel: string;
  shiftDate: string;
  shiftTimeSlot: TimeSlot;
  shiftRole: UserRole | 'Bất kỳ';
  requestingUser: AssignedUser;
  takenBy?: AssignedUser; // The user who took over the shift
  declinedBy?: string[]; // Array of user IDs who declined
  targetUserId?: string; // For direct pass requests
  cancellationReason?: string; // Reason for automatic cancellation
}

export type Notification = {
    id: string;
    type: NotificationType;
    status: NotificationStatus;
    payload: PassRequestPayload;
    createdAt: string | Timestamp;
    resolvedBy?: AssignedUser;
    resolvedAt?: string | Timestamp;
};


export interface AuthUser extends User {
  displayName: string;
  role: UserRole;
  secondaryRoles?: UserRole[];
}

// --- Cashier Types ---

export type ExpenseType = 'goods_import' | 'other_cost';
export type OtherCostCategory = 'Lương' | 'Điện' | 'Nước' | 'Dịch vụ' | 'Sự cố' | 'Khác';
export type PaymentMethod = 'cash' | 'bank_transfer';

export type ExpenseItem = {
    itemId: string;
    name: string;
    supplier: string;
    quantity: number;
    unitPrice: number;
    unit: string;
}

export type ExpenseSlip = {
  id: string;
  date: string; // YYYY-MM-DD
  items: ExpenseItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  attachmentPhotos?: string[]; // URLs to the evidence images
  
  createdBy: AssignedUser;
  createdAt: string | Timestamp;
  lastModified?: string | Timestamp;
};


export type HandoverReport = {
  id: string; // cashier-handover-{date}
  date: string;
  posImageUrl?: string;
  posCashRevenue?: number;
  posTotalExpense?: number;
  startOfDayCash: number;
  actualCash: number;
  discrepancyReason?: string;
  discrepancyProofImageUrl?: string;
  
  createdBy: AssignedUser;
  createdAt: string | Timestamp;
  lastModified?: string | Timestamp;
  isBackfilled?: boolean; // For owner to fill later
  editHistory?: any[];
};

export type IncidentReport = {
  id: string;
  date: string;
  content: string;
  cost: number;
  
  createdBy: AssignedUser;
  createdAt: string | Timestamp;
  associatedExpenseSlipId?: string;
};

export type RevenueStats = {
  id: string; // YYYY-MM-DD
  date: string;
  netRevenue: number;
  revenueByPaymentMethod: {
    techcombankVietQrPro: number;
    cash: number;
    shopeeFood: number;
    grabFood: number;
    bankTransfer: number;
  };
  deliveryPartnerPayout: number;
  invoiceImageUrl: string;
  reportTimestamp?: string;
  isOutdated?: boolean;
  isEdited: boolean;

  createdBy: AssignedUser;
  createdAt: string | Timestamp;
};

// --- AI Invoice Extraction Types ---
export type ExtractedInvoiceItem = {
    itemName: string;
    quantity: number;
    unitPrice: number;
    matchedItemId: string | null;
    status: 'matched' | 'unmatched';
};

export type InvoiceExtractionResult = {
    isInvoiceFound: boolean;
    results: {
        invoiceTitle: string;
        imageIds: string[];
        items: ExtractedInvoiceItem[];
    }[];
};
