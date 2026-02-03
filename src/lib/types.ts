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
  photoURL?: string | null;
  /** Mark internal/dev accounts that should see test-only features/docs */
  isTestAccount?: boolean;
};

export type SimpleUser = {
  userId: string;
  userName: string;
};

export type AppSettings = {
  isRegistrationEnabled: boolean;
  isRecruitmentEnabled?: boolean;
  lastIssueNoteScan?: string | Timestamp;
  managerApprovalEnabled?: boolean;
  recruitmentQuestions?: RecruitmentQuestion[];
};

export type RecruitmentQuestionType = 'text' | 'yes_no' | 'multiple_choice';

export type RecruitmentQuestion = {
  id: string;
  question: string;
  type: RecruitmentQuestionType;
  options?: string[];
  required?: boolean;
};

export type Task = {
  id: string;
  text: string;
  isCritical?: boolean;
  type: 'photo' | 'boolean' | 'opinion';
  minCompletions?: number; // Minimum number of completions required to mark task as done (default: 1)
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
  name: string;
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
  note?: string; // For general notes/comments on the task
};

export type TaskCompletion = {
  [taskId: string]: CompletionRecord[];
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
  blob?: Blob; // For video files, which are not stored in photoStore
  url?: string; // local URL or Firebase Storage URL
};

export type MediaAttachment = {
  url: string;
  type: 'photo' | 'video';
};

export type CommentMedia = {
  id: string; // local ID from photoStore
  url: string;
  type: 'photo' | 'video';
};

export type PenaltySubmission = {
  userId: string;
  userName: string;
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
  penaltyPhotos?: string[]; //DEPRECATED
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
  requiredRoles?: { role: UserRole; count: number }[]; // e.g., [{role: 'Pha chế', count: 2}, ...]
};

export type AssignedUser = {
  userId: string;
  userName: string;
  assignedRole: UserRole;
};

export type AssignedUserWithRole = {
  userId: string;
  userName?: string;
  assignedRole: UserRole | 'Bất kỳ';
};

export type AssignedShift = {
  id: string; // Unique ID for this specific shift instance in the schedule
  templateId: string;
  date: string; // YYYY-MM-DD
  label: string;
  role: UserRole | 'Bất kỳ';
  timeSlot: TimeSlot;
  assignedUsers: AssignedUser[];
  assignedUsersWithRole?: AssignedUserWithRole[]; // Optional array of user-role pairs
  minUsers: number;
  requiredRoles?: { role: UserRole; count: number }[];
  employees?: EmployeeAttendance[]; // Augmented with attendance info on admin page
  /** Flag to indicate if absences in this shift have been processed for penalty/bonus */
  isPenaltyProcessed?: boolean;
};

export type EmployeeAttendance = {
  id: string;
  name: string;
  status: EmployeeStatus;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  /**
   * For continuous/multiple attendance sessions within a single shift.
   * If this array is present, checkInTime/checkOutTime may be used as a summary or primary session.
   */
  records?: {
    checkInTime: Date | null;
    checkOutTime: Date | null;
  }[];
  lateMinutes: number | null;
  lateReason: string | null;
  lateReasonPhotoUrl?: string | null;
  lateReasonMediaType?: 'photo' | 'video' | null;
  /** If the user requested to be late, this is the estimated late minutes */
  estimatedLateMinutes?: number | null;
};

export type EmployeeStatus = 'present' | 'late' | 'absent' | 'pending_late' | 'off-shift';

export type Schedule = {
  weekId: string; // e.g., "2024-W28"
  status: 'draft' | 'proposed' | 'published';
  shifts: AssignedShift[];
};

export type Availability = {
  userId: string;
  userName: string;
  date: string | Timestamp; // YYYY-MM-DD
  availableSlots: TimeSlot[];
};

export type ShiftBusyEvidence = {
  id: string;
  weekId: string;
  shiftId: string;
  shiftDate: string;
  shiftLabel: string;
  role: UserRole | 'Bất kỳ';
  submittedBy: SimpleUser;
  message: string;
  media?: MediaAttachment[];
  submittedAt: string | Timestamp | FieldValue;
  updatedAt?: string | Timestamp | FieldValue;
};

export type BusyReportTargetMode = 'users' | 'roles' | 'all';

export type BusyReportRequest = {
  id: string;
  weekId: string;
  shiftId: string;
  createdBy: SimpleUser;
  createdAt: string | Timestamp | FieldValue;
  updatedAt?: string | Timestamp | FieldValue;
  active: boolean;
  targetMode: BusyReportTargetMode;
  /** When targetMode==='users' */
  targetUserIds?: string[];
  /** When targetMode==='roles' */
  targetRoles?: UserRole[];
};

// --- Auto Scheduling Constraint Types ---
export type BaseConstraint = {
  id: string;
  enabled: boolean;
  notes?: string;
  mandatory?: boolean;
};

export type StaffPriority = BaseConstraint & {
  type: 'StaffPriority';
  userId: string;
  templateId?: string;
  weight: number;
};

export type ShiftStaffing = BaseConstraint & {
  type: 'ShiftStaffing';
  templateId?: string;
  role: UserRole | 'Bất kỳ';
  count: number;
};

export type DailyShiftLimit = BaseConstraint & {
  type: 'DailyShiftLimit';
  userId?: string; // global if omitted
  maxPerDay: number;
};

export type StaffShiftLink = BaseConstraint & {
  type: 'StaffShiftLink';
  userId: string;
  templateId: string;
  link: 'force' | 'ban';
};

export type StaffExclusion = BaseConstraint & {
  type: 'StaffExclusion';
  userId: string;
  blockedUserIds: string[];
  templateId?: string;
};

export type WorkloadLimit = BaseConstraint & {
  type: 'WorkloadLimit';
  scope: 'global' | 'user';
  userId?: string; // required when scope==='user'
  minShiftsPerWeek?: number;
  maxShiftsPerWeek?: number;
  minHoursPerWeek?: number;
  maxHoursPerWeek?: number;
};

export type AvailabilityStrictness = BaseConstraint & {
  type: 'AvailabilityStrictness';
  strict: boolean;
};

export type ScheduleCondition =
  | StaffPriority
  | ShiftStaffing
  | DailyShiftLimit
  | StaffShiftLink
  | StaffExclusion
  | WorkloadLimit
  | AvailabilityStrictness;

export type Assignment = {
  shiftId: string;
  role: UserRole | 'Bất kỳ';
  userId: string;
};

export type ScheduleRunResult = {
  assignments: Assignment[];
  unfilled: { shiftId: string; role: UserRole | 'Bất kỳ'; remaining: number }[];
  warnings: string[];
};

// --- AI Shift Scheduling Types ---
export type GenerateShiftScheduleInput = {
  weekId: string;
  constraintsText: string;
  users: ManagedUser[];
  availability: Availability[];
  shiftTemplates: ShiftTemplate[];
  existingSchedule?: Schedule | null;
};

export type GenerateShiftScheduleOutput = {
  schedule: Schedule;
  explanation: string;
  warnings?: string[];
};


// --- Notification System Types ---

export type NotificationStatus = 'pending' | 'pending_approval' | 'resolved' | 'cancelled';
export type NotificationType =
  'pass_request'
  | 'attendance_update'
  | 'schedule_proposal'
  | 'new_schedule'
  | 'schedule_changed'
  | 'new_daily_task_report'
  | 'new_task_report'
  | 'new_whistleblowing_report'
  | 'new_monthly_task_report'
  | 'new_expense_slip'
  | 'new_revenue_stats'
  | 'new_violation'
  | 'new_incident_report'
  | 'new_cash_handover_report'
  | 'new_ballot_draw'
  | 'salary_update';

export type PassRequestPayload = {
  notificationType?: 'pass_request';
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

export type NewSchedulePayload = {
  notificationType?: 'new_schedule'
}

export type DailyTaskReportPayload = {
  notificationType?: 'new_daily_task_report';
  taskId: string;
  taskTitle: string;
  assignedDate: string;
  reportId: string;
  url?: string;
}

export type NewViolationPayload = {
  notificationType?: 'new_violation';
  violationId: string;
  title: string;
}

export type AnyNotificationPayload = PassRequestPayload | NewSchedulePayload | NewViolationPayload | DailyTaskReportPayload;

export type Notification = {
  id: string;
  type: NotificationType;
  createdAt: string | Timestamp;
  messageTitle?: string,
  messageBody?: string,
  recipientUids?: string[];
  payload?: any;
  isRead?: { [userId: string]: boolean };
  // pass_request notifications only
  status?: NotificationStatus;
  resolvedBy?: AssignedUser;
  resolvedAt?: string | Timestamp;
};

export interface AuthUser extends User {
  displayName: string;
  role: UserRole;
  secondaryRoles?: UserRole[];
  anonymousName?: string;
  photoURL: string | null;
  /** Internal/dev flag: test accounts can see test-only events/features */
  isTestAccount?: boolean;
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

  createdBy: SimpleUser;
  createdAt: string | Timestamp;
  lastModified?: string | Timestamp;
  lastModifiedBy?: SimpleUser; // User who last edited the slip
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
  createdBy: SimpleUser;
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
  finalizedBy: SimpleUser;
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
  createdBy: SimpleUser;
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

  createdBy: SimpleUser;
  createdAt: string | Timestamp;
  lastModifiedBy?: SimpleUser;
};

// --- AI Flow Output Types ---
export type ExtractHandoverDataInput = {
  imageDataUri: string;
};

export type ExtractHandoverDataOutput = {
  isReceipt: boolean;
  rejectionReason?: string;
  shiftEndTime?: string;
  expectedCash?: number;
  startOfDayCash?: number;
  cashExpense?: number;
  cashRevenue?: number;
  deliveryPartnerPayout?: number;
  cashRefund?: number;
  otherRefund?: number;
  revenueByCard?: {
    techcombankVietQrPro?: number;
    shopeeFood?: number;
    grabFood?: number;
    bankTransfer?: number;
  };
};

export type ExtractInvoiceItemsInput = {
  images: { id: string; uri: string }[];
  inventoryItems: InventoryItem[];
};

export type ExtractedItem = {
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  lineItemDiscount: number;
  matchedItemId: string | null;
  status: 'matched' | 'unmatched';
};

export type InvoiceResult = {
  invoiceTitle: string;
  imageIds: string[];
  items: ExtractedItem[];
  totalDiscount: number;
};

export type ExtractInvoiceItemsOutput = {
  isInvoiceFound: boolean;
  rejectionReason?: string;
  results: InvoiceResult[];
};

export type ExtractRevenueInput = {
  imageDataUri: string;
};

export type RevenueByPaymentMethod = {
  techcombankVietQrPro: number;
  cash: number;
  shopeeFood: number;
  grabFood: number;
  bankTransfer: number;
}

export type ExtractRevenueOutput = {
  isReceipt: boolean;
  rejectionReason?: string;
  reportTimestamp?: string;
  netRevenue?: number;
  deliveryPartnerPayout?: number;
  revenueByPaymentMethod?: RevenueByPaymentMethod;
};

export type GenerateBartenderTasksInput = {
  source: 'text' | 'image';
  inputText?: string;
  imageDataUri?: string;
};

export type GenerateBartenderTasksOutput = {
  tasks: {
    text: string;
    type: 'photo' | 'boolean' | 'opinion';
  }[];
};

export type GenerateComprehensiveTasksInput = {
  source: 'text' | 'image';
  inputText?: string;
  imageDataUri?: string;
};

export type GenerateComprehensiveTasksOutput = {
  tasks: {
    text: string;
    type: 'photo' | 'boolean' | 'opinion';
  }[];
};

export type GenerateDailySummaryInput = {
  date: string;
  reports: any[];
  taskDefinitions: {
    serverTasks: TasksByShift;
    bartenderTasks: TaskSection[];
    comprehensiveTasks: ComprehensiveTaskSection[];
    inventoryItems: InventoryItem[];
  };
};

export type GenerateDailySummaryOutput = {
  summary: string;
};

export type GenerateInventoryListInput = {
  source: 'text' | 'image';
  inputText?: string;
  imageDataUri?: string;
};

export type GenerateInventoryListOutput = {
  items: InventoryItem[];
};

export type GenerateProductRecipesInput = {
  inputText?: string;
  imageDataUri?: string;
  inventoryItems: InventoryItem[];
  allProducts: Product[];
};

export type GenerateProductRecipesOutput = {
  products: ParsedProduct[];
};

export type GenerateServerTasksInput = {
  source: 'text' | 'image';
  inputText?: string;
  imageDataUri?: string;
};

export type ParsedTask = {
  text: string;
  isCritical: boolean;
  type: 'photo' | 'boolean' | 'opinion';
}

export type GenerateServerTasksOutput = {
  tasks: ParsedTask[];
};

export type GenerateStartingTaskListInput = {
  description: string;
};

export type GenerateStartingTaskListOutput = {
  taskList: string[];
};

export type SortTasksInput = {
  context: string;
  tasks: string[];
  userInstruction?: string;
};

export type SortTasksOutput = {
  sortedTasks: string[];
};

export type UpdateInventoryItemsInput = {
  items: InventoryItem[];
  instruction: string;
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
  /** @deprecated Use media instead */
  photos?: string[];
  media?: MediaAttachment[];
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
export type BreakRecord = {
  breakStartTime: string | Timestamp;
  breakStartPhotoUrl?: string;
  breakEndTime?: string | Timestamp;
  breakEndPhotoUrl?: string;
};

export type AttendanceRecord = {
  id: string;
  userId: string;
  checkInTime?: string | Timestamp;
  photoInUrl?: string;
  checkOutTime?: string | Timestamp;
  photoOutUrl?: string;
  status: 'in-progress' | 'completed' | 'auto-completed' | 'pending_late';
  totalHours?: number;
  salary?: number;
  hourlyRate?: number;
  /** Base hourly rate before any special period multiplier is applied. */
  baseHourlyRate?: number;
  /** Multiplier applied to baseHourlyRate when a special period is in effect. */
  salaryMultiplierApplied?: number;
  /** Special period metadata applied to this record (if any). */
  specialPeriodAppliedId?: string | null;
  specialPeriodAppliedName?: string | null;
  isOffShift?: boolean;
  offShiftReason?: string;
  estimatedLateMinutes?: number;
  lateReason?: string;
  lateReasonPhotoUrl?: string;
  onBreak?: boolean;
  breaks?: BreakRecord[];
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
};

// --- Salary Management Types ---

export type SpecialPeriod = {
  id: string;
  name: string;
  startDate: string | Timestamp;
  endDate: string | Timestamp;
  multiplier: number;
  /** If omitted/empty, applies to all users. */
  targetUserIds?: string[];
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
};

export type BonusRecord = {
  id: string;
  amount: number;
  note: string;
  createdBy: SimpleUser;
  createdAt: string | Timestamp;
};

export type SalaryAdvanceRecord = {
  id: string;
  amount: number;
  note: string;
  createdBy: SimpleUser;
  createdAt: string | Timestamp;
};

export type SalaryRecord = {
  userId: string;
  userName: string;
  userRole: UserRole;
  totalWorkingHours: number;
  totalExpectedHours: number;
  totalSalary: number;
  averageHourlyRate: number;
  totalUnpaidPenalties: number;
  totalLateMinutes: number;
  attendanceRecords: AttendanceRecord[];
  violationRecords: Violation[];
  absentShifts: AssignedShift[];
  paymentStatus?: 'paid' | 'unpaid';
  paidAt?: Timestamp;
  salaryAdvance?: number;
  advances?: SalaryAdvanceRecord[];
  bonus?: number;
  bonuses?: BonusRecord[];
  actualPaidAmount?: number;
};

export type MonthlySalarySheet = {
  id: string; // YYYY-MM
  calculatedAt: Timestamp;
  calculatedBy: SimpleUser;
  scheduleMap: Record<string, Schedule>; // Keyed by weekId
  salaryRecords: Record<string, SalaryRecord>; // Keyed by userId
  eligibility?: {
    threshold: number;
    penaltiesMustBeZero: boolean;
  };
};

// --- Daily Assignments ---

export type DailyTaskTargetMode = 'roles' | 'users';

export type DailyTaskStatus = 'open' | 'in_review' | 'completed';

export type DailyTask = {
  id: string;
  title: string;
  description: string;
  assignedDate: string; // YYYY-MM-DD
  targetMode: DailyTaskTargetMode;
  targetRoles?: UserRole[];
  targetUserIds?: string[];
  createdBy: SimpleUser;
  createdByRole: UserRole;
  media?: MediaAttachment[];
  status: DailyTaskStatus;
  completedAt?: string | Timestamp;
  completedBy?: SimpleUser;
  summaryNote?: string;
  createdAt: string | Timestamp | FieldValue;
  updatedAt: string | Timestamp | FieldValue;
};

export type DailyTaskReportStatus = 'submitted' | 'manager_approved' | 'rejected';

export type DailyTaskReport = {
  id: string;
  taskId: string;
  taskTitle: string;
  assignedDate: string;
  reporter: SimpleUser;
  content?: string;
  media?: MediaAttachment[];
  status: DailyTaskReportStatus;
  managerNote?: string;
  reviewedBy?: SimpleUser;
  reviewedAt?: string | Timestamp | FieldValue;
  createdAt: string | Timestamp | FieldValue;
  updatedAt: string | Timestamp | FieldValue;
};

// --- Monthly Tasks ---

export type TaskSchedule =
  | {
    type: 'weekly';
    daysOfWeek: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  }
  | {
    type: 'interval';
    intervalDays: number; // e.g., 3 for "every 3 days"
    startDate: string; // YYYY-MM-DD
  }
  | {
    type: 'monthly_date';
    daysOfMonth: number[]; // e.g., [1, 15] for 1st and 15th of the month
  }
  | {
    type: 'monthly_weekday';
    // e.g., [{ week: 1, day: 1 }] for the first Monday of the month
    // e.g., [{ week: -1, day: 5 }] for the last Friday of the month
    occurrences: { week: number; day: number }[];
  }
  | {
    type: 'random';
    period: 'week' | 'month' | 'custom_days';
    count: number; // How many times per period
    customDays?: number; // For 'custom_days' period
    excludeWeekends?: boolean;
  };

export type MonthlyTask = {
  id: string;
  name: string;
  description: string;
  appliesToRole: UserRole | 'Tất cả';
  schedule: TaskSchedule;
  /** 
   * Optional time of day for the task. If not set, it applies for the whole day.
   * If set, the task only applies to staff whose shift overlaps with this time.
   */
  timeOfDay?: string; // "HH:mm"
  /**
   * For tasks with 'random' schedule type, this will hold the pre-generated dates.
   * For other types, this is not used.
   */
  scheduledDates?: string[]; // Array of YYYY-MM-DD strings
};

export type TaskCompletionRecord = {
  completionId?: string;
  taskId: string;
  taskName: string;
  completedBy?: SimpleUser;
  assignedDate: string; // YYYY-MM-DD
  completedAt?: Timestamp;
  /** Exact time when a NOTE was sent (different from completedAt). */
  noteCreatedAt?: Timestamp;
  media?: MediaAttachment[]; // Array to store photos/videos
  note?: string;
};

export type MonthlyTaskAssignment = {
  taskId: string;
  taskName: string;
  description: string;
  assignedDate: string; // YYYY-MM-DD
  appliesToRole?: UserRole | 'Tất cả';

  // New structure for collaborative tasks
  responsibleUsersByShift: {
    shiftId: string;
    shiftLabel: string;
    users: AssignedUser[];
  }[];
  completions: TaskCompletionRecord[];
  otherCompletions: TaskCompletionRecord[];
};

// --- Event Feature Types ---
export type EventType = 'vote' | 'multi-vote' | 'review' | 'ballot';
export type EventStatus = 'draft' | 'waiting' | 'active' | 'closed';

export type EventCandidate = {
  id: string; // Can be userId or a custom ID for an option
  name: string;
  avatarUrl?: string;
  meta?: Record<string, any>; // For extra details like role, etc.
};

export type Event = {
  id: string;
  title: string;
  description: string;
  type: EventType;
  status: EventStatus;
  ownerId: string; // UID of the owner who created it
  startAt: Timestamp;
  endAt: Timestamp;
  
  // Eligibility
  eligibleRoles: UserRole[];
  targetUserIds?: string[]; // Specific users targeted for this event
  
  // Content
  candidates: EventCandidate[]; // For staff-based events
  options?: EventCandidate[]; // For non-staff choices
  allowComments: boolean;
  anonymousResults: boolean;
  
  // Voting Rules
  maxVotesPerUser?: number; // For multi-vote
  prize?: {
    name: string;
    description: string;
    imageUrl?: string;
  };
  // Ballot-specific configuration
  ballotConfig?: {
    winnerCount: number;
    resultMessage: string; // Message to show to winners
    loserMessage: string; // Message to show to non-winners
    autoDraw: boolean; // Whether to run automatically at end time
    ballotDrawTime?: Timestamp; // Specific time for ballot draw (separate from event end time)
  };
  /** Mark event as test-only — only visible to users with `isTestAccount` */
  isTest?: boolean;
};

export type EventVote = {
  id: string; // Typically the userId to enforce one vote per user per event
  eventId: string;
  userId: string;
  userDisplay: UserNameWithRole;
  createdAt: Timestamp;

  // Data fields depending on event type
  votes?: string[]; // Array of candidate/option IDs for vote/multi-vote/ballot
  ratings?: { [candidateId: string]: number }; // For review
  comments?: { [candidateId: string]: string }; // For review
};

export type UserNameWithRole = {
  name: string;
  role: UserRole;
};

export type PrizeDrawResult = {
  id: string;
  eventId: string;
  drawnAt: Timestamp;
  winners: {
    userId: string;
    userName: string;
  }[];
};


export type VoteResult = {
    id: string;
    name: string;
    votes: number;
    voters: string[];
    avgRating: number;
    ratingCount: number;
    comments: ReviewComment[];
};

export type ReviewComment = { text: string; author: string };

export type ReviewResult = {
    id: string;
    name: string;
    voters: string[];
    avgRating: number;
    ratingCount: number;
    comments: ReviewComment[];
};

export type EventResult = VoteResult | ReviewResult;

// --- Recruitment Feature Types ---

export type JobApplication = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  birthYear: number;
  gender: 'Nam' | 'Nữ' | 'Khác';
  position: UserRole;
  experience: string;
  note?: string;
  photoUrl?: string;
  customAnswers?: Record<string, string>;
  status: 'pending' | 'reviewed' | 'rejected' | 'hired';
  createdAt: string;
  updatedAt: string;
};

