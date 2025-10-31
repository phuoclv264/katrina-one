'use client';

import type { Timestamp, FieldValue } from 'firebase/firestore';
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
  hourlyRate?: number; // Added for payroll
};

export type AppSettings = {
  isRegistrationEnabled: boolean;
  lastIssueNoteScan?: string | Timestamp;
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

export type GlobalUnit = {
  id: string;
  name: string;
};

export type UnitDefinition = {
  name: string;
  isBaseUnit: boolean;
  conversionRate: number; // How many base units are in this unit. The base unit itself has a rate of 1.
};

export type InventoryItem = {
    id: string;
    name: string;
    shortName: string; 
    category: string;
    supplier: string;
    
    unit?: string; // DEPRECATED, use baseUnit and units instead
    baseUnit: string; // The smallest unit for stock tracking (e.g., "ml", "gram")
    units: UnitDefinition[]; // Array of all possible units for this item
    
    minStock: number; // In baseUnit
    orderSuggestion: string; // e.g., "4" or "5kg"
    requiresPhoto?: boolean;
    isImportant?: boolean;
    dataType: 'number' | 'list';
    listOptions?: string[];
};


export type Suppliers = string[];

// Type for AI-parsed items before they get a real ID
export type ParsedInventoryItem = Omit<InventoryItem, 'id' | 'unit'>;


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

// --- Product & Recipe Types ---
export type ProductIngredient = {
  inventoryItemId?: string; // Links to an item in the InventoryItem[] list
  productId?: string; // OR links to another product (sub-recipe)
  name: string; // The original name from the recipe text, for display
  quantity: number;
  unit: string; // e.g., 'gram', 'ml', 'viên'
  isMatched: boolean; // Indicates if inventoryItemId/productId is a confident match
};

export type Product = {
  id: string;
  name: string;
  category: string;
  ingredients: ProductIngredient[];
  note?: string; // Optional notes, e.g., for preparation steps
  isIngredient?: boolean; // Can this product be used as an ingredient in another product? Defaults to false.
  yield?: {
    quantity: number;
    unit: string;
  }
};

export type ParsedProduct = Omit<Product, 'id'>;


// --- Violation Logging Types ---
export type FineRule = {
    id: string;
    condition: 'repeat_in_month' | 'is_flagged';
    threshold: number; // e.g., 4 for "from the 4th time"
    action: 'multiply' | 'add';
    value: number; // e.g., 2 for "multiply by 2"
    severityAction?: 'increase' | 'set_to_high' | null;
};

export type ViolationCategory = {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high';
  calculationType: 'fixed' | 'perUnit';
  fineAmount: number;
  finePerUnit: number | null;
  unitLabel: string | null;
};

export type ViolationCategoryData = {
    list: ViolationCategory[];
    generalRules?: FineRule[];
    generalNote?: string;
};


export type ViolationUser = {
  id: string;
  name: string;
}

export type MediaItem = {
  id: string; // local ID from photoStore
  type: 'photo' | 'video';
};

export type MediaAttachment = {
  url: string;
  type: 'photo' | 'video';
};

export type PenaltySubmission = {
  userId: string;
  userName: string;
  /** @deprecated Use media instead */
  photos?: string[];
  media?: MediaAttachment[];
  submittedAt: string | Timestamp;
};

export type ViolationUserCost = {
  userId: string;
  cost: number;
  severity: 'low' | 'medium' | 'high';
};

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
  users: ViolationUser[];
  reporterId: string;
  reporterName: string;
  photos: string[];
  createdAt: string | Timestamp;
  lastModified?: string | Timestamp;
  penaltySubmissions?: PenaltySubmission[];
  isFlagged?: boolean;
  isPenaltyWaived?: boolean;
  comments?: ViolationComment[];

  // Snapshot of the category at the time of violation
  categoryId: string;
  categoryName: string;
  severity: 'low' | 'medium' | 'high';
  cost: number;
  unitCount?: number;
  userCosts?: ViolationUserCost[]; // Details for each user's penalty
};


// --- Summary Types ---
export type DailySummary = {
    id?: string; // date YYYY-MM-DD
    summary: string;
    generatedAt: string | Timestamp;
};

export type IssueNote = {
  id: string;
  reportId: string;
  date: string;
  shiftKey: string;
  shiftName: string;
  staffName: string;
  note: string;
  scannedAt: string | Timestamp;
};


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
  isSwapRequest?: boolean; // For direct shift swaps
  targetUserShiftPayload?: { // Snapshot of the target user's shift for swaps
      shiftId: string;
      shiftLabel: string;
      shiftTimeSlot: TimeSlot;
      date: string;
  };
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

export type PaymentMethod = 'cash' | 'bank_transfer' | 'intangible_cost';

export type ExpenseItem = {
    itemId: string; // Product ID for goods, or 'other_cost'
    otherCostCategoryId?: string; // ID of the OtherCostCategory
    name: string; // For goods: Product Name. For 'other': The specific category name like "Tiền điện"
    description?: string; // Specific description for 'other_cost' when category is "Khác"
    supplier?: string;
    quantity: number;
    unitPrice: number;
    unit: string; // The name of the UnitDefinition used for this transaction.
    isPaid?: boolean; // Track payment status for each item
}

export type ExpenseSlip = {
  id: string;
  date: string; // YYYY-MM-DD
  expenseType: ExpenseType;
  items: ExpenseItem[];
  totalAmount: number;
  actualPaidAmount?: number;
  discount?: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  attachmentPhotos?: string[]; // URLs to the evidence images
  paymentStatus?: 'paid' | 'unpaid';
  
  isAiGenerated?: boolean; // Flag to indicate if the slip was generated by AI without manual edits

  createdBy: AssignedUser;
  createdAt: string | Timestamp;
  lastModified?: string | Timestamp;
  lastModifiedBy?: AssignedUser; // User who last edited the slip
  associatedHandoverReportId?: string; // Link to the handover report
  associatedIncidentId?: string;
};

export type OtherCostCategory = {
  id: string;
  name: string;
};

export type CashCount = {
  id: string;
  timestamp: string | Timestamp;
  countedBy: AssignedUser;
  actualCash: number;
  expectedCash: number;
  discrepancy: number;
  discrepancyReason?: string;
  discrepancyProofPhotos?: string[];
};

/**
 * [MỚI] Cấu trúc cho một biên bản kiểm kê tiền mặt độc lập (schema v2).
 */
export interface CashHandoverReport {
  id: string;
  createdAt: Timestamp | FieldValue;
  createdBy: AssignedUser;
  date: string; // YYYY-MM-DD
  actualCashCounted: number;
  discrepancyReason: string | null;
  discrepancyProofPhotos: string[];
  startOfDayCash: number;
  linkedExpenseSlipIds: string[];
  linkedRevenueStatsId: string | null;
  finalHandoverDetails?: FinalHandoverDetails;
}

/**
 * [MỚI] Cấu trúc cho dữ liệu bàn giao cuối cùng, được lưu vào báo cáo kiểm kê mới nhất.
 */
export interface FinalHandoverDetails {
  receiptData: ExtractHandoverDataOutput & { imageDataUri: string };
  receiptImageUrl: string | null;
  finalizedAt: Timestamp | FieldValue;
  finalizedBy: AssignedUser;
}

export type IncidentCategory = {
  id: string;
  name: string;
};

export type IncidentReport = {
  id: string;
  date: string;
  content: string;
  cost: number;
  paymentMethod?: PaymentMethod;
  photos: string[];
  category: string;
  
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
  invoiceImageUrl: string | null;
  reportTimestamp?: string;
  isOutdated?: boolean;
  isAiGenerated?: boolean;
  isEdited: boolean;

  createdBy: AssignedUser;
  createdAt: string | Timestamp;
  lastModifiedBy?: AssignedUser;
};

// --- AI Flow Output Types ---

export type ExtractHandoverDataOutput = {
  isReceipt: boolean;
  rejectionReason?: string;
  shiftEndTime?: string;
  expectedCash?: number;
  startOfDayCash?: number;
  cashExpense?: number;
  cashRevenue?: number;
  deliveryPartnerPayout?: number;
  revenueByCard?: {
    techcombankVietQrPro?: number;
    shopeeFood?: number;
    grabFood?: number;
    bankTransfer?: number;
  };
};


// --- AI Invoice Extraction Types ---
export type ExtractedInvoiceItem = {
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    lineItemDiscount: number;
    matchedItemId: string | null;
    status: 'matched' | 'unmatched';
};

export type InvoiceExtractionResult = {
    isInvoiceFound: boolean;
    results: {
        invoiceTitle: string;
        imageIds: string[];
        items: ExtractedInvoiceItem[];
        totalDiscount: number;
    }[];
};

// --- Report System Types ---

export type Attachment = {
  url: string;
  name: string;
  type: string; // MIME type
};

export type ReportComment = {
  id: string;
  authorId: string;
  isAnonymous: boolean;
  content: string;
  createdAt: string | Timestamp;
  photos?: string[];
};

export type WhistleblowingReport = {
  id: string;
  title: string;
  content: string;
  attachments?: Attachment[];
  accusedUsers: ManagedUser[];
  reporterId: string;
  isAnonymous: boolean;
  visibility: 'public' | 'private';
  isPinned?: boolean; // New field for pinning
  upvotes: string[];
  downvotes: string[];
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
  commentCount?: number;
  comments?: ReportComment[];
  anonymousNameMap?: { [userId: string]: string };
};

// --- Attendance Types ---
export type AttendanceRecord = {
  id: string;
  userId: string;
  checkInTime: string | Timestamp;
  photoInUrl?: string;
  checkOutTime?: string | Timestamp;
  photoOutUrl?: string;
  status: 'in-progress' | 'completed' | 'auto-completed';
  totalHours?: number;
  salary?: number;
  isOffShift?: boolean;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
};
