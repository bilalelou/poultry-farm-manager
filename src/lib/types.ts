// ============================================================
// أنواع البيانات الأساسية لتطبيق إدارة مزرعة الدواجن
// ============================================================

// === إعدادات المشروع ===
export interface Settings {
  id?: number;
  // سعة الفقاسة
  incubatorCapacity: number;
  // أسعار الأعلاف (درهم/كغ)
  feedPrices: {
    starter: number;   // بادي (أسبوع 1-6)
    grower: number;    // نامي (أسبوع 7-18)
    preLayer: number;  // ما قبل البيض (أسبوع 19-20)
    layer: number;     // بياض
  };
  // استهلاك العلف اليومي (غرام/دجاجة)
  dailyFeedConsumption: {
    starter: number;
    grower: number;
    preLayer: number;
    layer: number;
  };
  // أسعار البيع
  sellingPrices: {
    egg: number;           // سعر البيضة
    tray: number;          // سعر الصينية (30 بيضة)
    fertilizedEgg: number; // سعر البيض المخصب
    chick: number;         // سعر الكتكوت
    culledHen: number;     // سعر الدجاجة المستبعدة
    maleBroiler: number;   // سعر الذكر
    manure: number;        // سعر السماد (للكيس)
  };
  // سعر السوق للدجاجة الجاهزة
  marketReadyHenPrice: number;
  // نسب الأهداف المعيارية (%)
  targetRates: {
    fertility: number;    // نسبة الإخصاب
    hatch: number;        // نسبة الفقس
    production: number;   // نسبة الإنتاج
    maxMortality: number; // الحد الأقصى للنفوق
  };
  // كثافة التربية (دجاجة/م²)
  housingDensity: number;
  // تكلفة كهرباء الفقاسة لكل دورة
  incubatorElectricityCost: number;
  // تكلفة تنظيف وتطهير الفقاسة
  incubatorCleaningCost: number;
  // العملة
  currency: string;
  currencySymbol: string;
}

// === دفعات الفقاسة ===
export type BatchStatus = 'incubating' | 'hatched' | 'transferred';
export type EggSource = 'internal' | 'external';

export interface IncubatorBatch {
  id?: number;
  batchCode: string;
  startDate: string; // ISO date
  eggCount: number;
  eggSource: EggSource;
  eggCost: number; // إجمالي تكلفة البيض
  // فحص اليوم 7
  fertilizedCount?: number;
  fertilityRate?: number;
  // نتائج الفقس (اليوم 21)
  hatchedChicks?: number;
  spoiledEggs?: number;
  hatchRate?: number;
  // تكاليف
  electricityCost: number;
  cleaningCost: number;
  // حسابات
  totalCost?: number;
  costPerChick?: number;
  // حالة
  status: BatchStatus;
  linkedRearingBatchId?: number;
  notes?: string;
  createdAt: string;
}

// === دفعات التربية ===
export type RearingStatus = 'rearing' | 'completed' | 'transferred';
export type FeedPhase = 'starter' | 'grower' | 'preLayer';

export interface RearingBatch {
  id?: number;
  batchCode: string;
  incubatorBatchId?: number;
  startDate: string;
  initialChickCount: number;
  initialCostPerChick: number;
  currentHealthyCount?: number; // العدد السليم / المتبقي حالياً (إجمالي الأحياء)
  mortalityCount?: number;      // عدد النفوق / الهالك
  malesCount?: number;          // عدد الذكور / الديوك
  currentAgeWeeks?: number;     // عمر الدفعة بالأسابيع عند التاريخ المرجعي
  ageReferenceDate?: string;    // تاريخ تسجيل/تحديث العمر (ISO YYYY-MM-DD)
  status: RearingStatus;
  autoTransferToProduction?: boolean; // النقل التلقائي للإنتاج عند إتمام الأسبوع 21
  notes?: string;
  createdAt: string;
}

export interface RearingWeeklyLog {
  id?: number;
  rearingBatchId: number;
  weekNumber: number; // 1-20
  feedPhase: FeedPhase;
  remainingCount: number;
  weeklyMortality: number;
  cumulativeMortalityRate: number;
  feedConsumed: number; // كغ
  feedCost: number;
  heatingCost: number;
  lightingCost: number;
  beddingCost: number;
  vaccinationCost: number;
  medicineCost: number;
  otherCosts: number;
  totalWeeklyCost: number;
  // بيع الذكور
  malesSold: number;
  malesSaleValue: number;
  notes?: string;
}

// === الإنتاج اليومي ===
export interface DailyProduction {
  id?: number;
  date: string; // ISO date
  activeHenCount: number;
  dailyMortality: number;
  totalEggsCollected: number;
  brokenEggs: number;
  incubatorEggs: number;
  personalUse: number;
  netSaleableEggs: number; // محسوب
  productionRate: number;  // محسوب (%)
  notes?: string;
}

// === المبيعات ===
export type SaleType = 'eggs' | 'fertilizedEggs' | 'chicks' | 'culledHens' | 'manure' | 'males';
export type UnitType = 'unit' | 'tray';
export type PaymentStatus = 'paid' | 'partial' | 'unpaid';

export interface Sale {
  id?: number;
  date: string;
  type: SaleType;
  quantity: number;
  unitType: UnitType;
  unitPrice: number;
  total: number;
  buyerName?: string;
  customerId?: number;
  paidAmount?: number;
  paymentStatus?: PaymentStatus;
  notes?: string;
}

export interface Customer {
  id?: number;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DebtPayment {
  id?: number;
  date: string;
  customerId?: number;
  customerName: string;
  saleId?: number;
  amount: number;
  paymentMethod: 'cash' | 'bank' | 'check';
  notes?: string;
  createdAt?: string;
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: 'خالص',
  partial: 'مدفوع جزئياً',
  unpaid: 'كريدي',
};

// === الديون التي على المزرعة (الالتزامات) ===
export type PayableCategory = 'feed' | 'equipment' | 'chicks' | 'medicine' | 'loan' | 'rent' | 'other';

export interface PayableDebt {
  id?: number;
  date: string;
  creditorName: string;
  phone?: string;
  category: PayableCategory;
  description: string;
  totalAmount: number;
  paidAmount: number;
  dueDate?: string;
  status: PaymentStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PayablePayment {
  id?: number;
  debtId: number;
  date: string;
  amount: number;
  paymentMethod: 'cash' | 'bank' | 'check';
  notes?: string;
  createdAt?: string;
}

export const PAYABLE_CATEGORY_LABELS: Record<PayableCategory, string> = {
  feed: 'أعلاف',
  chicks: 'عتوكة / كتاكيت / بيض',
  equipment: 'معدات وتجهيزات',
  medicine: 'أدوية ولقاحات',
  loan: 'سلف / قرض شخصي',
  rent: 'إيجار / كهرباء / ماء',
  other: 'أخرى',
};

// === مخزون العلف ===
export type FeedStockType = 'starter' | 'grower' | 'preLayer' | 'layer';
export type FeedMovementType = 'purchase' | 'consumption' | 'adjustment';

export interface FeedMovement {
  id?: number;
  date: string;
  movementType: FeedMovementType;
  feedType: FeedStockType;
  quantityKg: number;
  cost: number;
  expenseId?: number;
  notes?: string;
  createdAt?: string;
}

export const FEED_TYPE_LABELS: Record<FeedStockType, string> = {
  starter: 'بادي (1-6 أسابيع)',
  grower: 'نامي (7-18 أسبوع)',
  preLayer: 'ما قبل البيض (19-20)',
  layer: 'بياض',
};

export const FEED_MOVEMENT_LABELS: Record<FeedMovementType, string> = {
  purchase: 'شراء / دخول للمخزون',
  consumption: 'استهلاك القطيع',
  adjustment: 'تعديل / جرد يدوي',
};

// === سجل أخطاء النظام ===
export type SystemLogLevel = 'error' | 'warn' | 'info';

export interface SystemLog {
  id?: number;
  timestamp: string;
  level: SystemLogLevel;
  source: 'client' | 'api' | 'ui' | 'db';
  page?: string;
  message: string;
  details?: string;
  resolved?: boolean;
  createdAt?: string;
}

// === المصاريف ===
export type ExpenseScope = 'general' | 'batch' | 'foundation';
export type ExpenseType = 'operational' | 'capital';
export type ExpenseCategory =
  | 'feed' | 'medicine' | 'electricity' | 'water'
  | 'heating' | 'equipment' | 'bedding' | 'transport'
  | 'cleaning' | 'vaccination' | 'labor' | 'rent' | 'other';

export interface Expense {
  id?: number;
  date: string;
  scope: ExpenseScope;
  batchId?: number;
  batchType?: 'incubator' | 'rearing';
  type: ExpenseType;
  category: ExpenseCategory;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string;
}

// === المستثمرون وتقييم المشروع ===
export interface Investor {
  id?: number;
  name: string;
  phone?: string;
  email?: string;
  investedAmount: number;
  ownershipShare: number; // نسبة الحصة %
  entryDate: string;
  totalDistributed: number; // إجمالي الأرباح الموزعة
  status: 'active' | 'exited';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ValuationCategory = 'equipment' | 'livestock' | 'realestate' | 'cash' | 'other';

export interface ValuationItem {
  id?: number;
  category: ValuationCategory;
  name: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  notes?: string;
  updatedAt?: string;
}

export const VALUATION_CATEGORY_LABELS: Record<ValuationCategory, string> = {
  equipment: 'معدات وتجهيزات (فقاسات، معالف، سقايات)',
  livestock: 'ثروة حيوانية (دجاج بياض، عتوكة، ديوك)',
  realestate: 'بنية تحتية وعنابر وبناء',
  cash: 'سيولة نقدية ومخزون أعلاف وبيض',
  other: 'أصول أخرى',
};

// === مجموعات القطيع العام ===
export type FlockCategory = 'layers' | 'roosters' | 'pullets' | 'chicks' | 'broilers';

export interface FlockGroup {
  id?: number;
  name: string;
  category: FlockCategory;
  breed: string;
  headCount: number;
  malesCount: number;
  femalesCount: number;
  ageWeeks: number;
  ageReferenceDate?: string;
  housing?: string;
  healthStatus: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const FLOCK_CATEGORY_LABELS: Record<FlockCategory, string> = {
  layers: 'دجاج بياض منتج',
  roosters: 'ديوك التخصيب / التلقيح',
  pullets: 'عتوكة (ما قبل البيض)',
  chicks: 'كتاكيت وحضانة',
  broilers: 'تسمين / لحم',
};

export type FlockMovementType = 'transfer' | 'addition' | 'mortality' | 'sale' | 'culling';

export interface FlockMovement {
  id?: number;
  date: string;
  flockGroupId?: number;
  flockName: string;
  movementType: FlockMovementType;
  fromLocation?: string;
  toLocation?: string;
  malesCount: number;
  femalesCount: number;
  totalCount: number;
  reason?: string;
  notes?: string;
  createdAt?: string;
}

export const FLOCK_MOVEMENT_LABELS: Record<FlockMovementType, string> = {
  transfer: 'نقل بين العنابر',
  addition: 'إضافة / دخول للقطيع',
  mortality: 'نفوق',
  sale: 'بيع',
  culling: 'استبعاد / فرز',
};
export type ExpansionSource = 'incubator' | 'purchased';
export type ExpansionStrategy = 'incubator' | 'hybrid' | 'purchased' | 'pullets_100_full_inc' | 'staged_3m_learn_full_inc';

export interface ExpansionPlanMonth {
  id?: number;
  planId: number;
  month: number; // 1-24
  addedHens: number;
  incubatorEggsUsed?: number;
  source: ExpansionSource;
  estimatedMortality: number;
  netActiveHens: number;
  requiredSpaceM2: number;
  monthlyFeedKg: number;
  feedCost: number;
  rearingCost?: number;
  expectedEggProduction: number;
  maleSalesRevenue?: number;
  expectedRevenue: number;
  operationalCost: number;
  expectedProfit: number;
  cumulativeProfit: number;
  selfFinancingGap: number;
  milestoneNote?: string;
}

export interface ExpansionPlan {
  id?: number;
  name: string;
  durationMonths: number; // 12 or 24
  targetMonthlyProfit?: number;
  strategy?: ExpansionStrategy;
  description?: string;
  startDate: string;
  createdAt: string;
  months?: ExpansionPlanMonth[];
}

// === التنبيهات ===
export type AlertType = 'info' | 'warning' | 'danger' | 'success';
export type AlertCategory = 'incubator' | 'vaccination' | 'production' | 'mortality' | 'general';

export interface Alert {
  id?: number;
  date: string;
  type: AlertType;
  category: AlertCategory;
  title: string;
  message: string;
  relatedBatchId?: number;
  isRead: boolean;
  createdAt: string;
}

// === تسيير التعاونية ===
export type CoopMemberRole = 'president' | 'vice_president' | 'treasurer' | 'secretary' | 'member';
export type CoopMemberStatus = 'active' | 'suspended' | 'exited';
export type CoopTxType =
  | 'contribution'
  | 'grant'
  | 'coop_sale'
  | 'coop_expense'
  | 'admin_expense'
  | 'profit_distribution';
export type CoopTxCategory = 'shares' | 'feed' | 'equipment' | 'eggs' | 'subsidy' | 'admin' | 'other';
export type CoopPaymentMethod = 'cash' | 'bank' | 'check';
export type CoopMeetingType = 'general_ordinary' | 'general_extraordinary' | 'board_meeting';

export interface CooperativeProfile {
  id?: number;
  name: string;
  registrationNo?: string;
  foundedDate?: string;
  headquarters?: string;
  activity: string;
  bankRib?: string;
  shareUnitValue: number;
  legalReserveRate: number;
  notes?: string;
  updatedAt?: string;
}

export interface CooperativeMember {
  id?: number;
  fullName: string;
  cin?: string;
  phone?: string;
  role: CoopMemberRole;
  joinDate: string;
  sharesCount: number;
  paidCapital: number;
  status: CoopMemberStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CooperativeTransaction {
  id?: number;
  date: string;
  type: CoopTxType;
  category: CoopTxCategory;
  memberId?: number;
  memberName?: string;
  amount: number;
  paymentMethod: CoopPaymentMethod;
  referenceNo?: string;
  description: string;
  notes?: string;
  createdAt?: string;
}

export interface CooperativeMeeting {
  id?: number;
  date: string;
  title: string;
  type: CoopMeetingType;
  attendeesCount: number;
  agenda: string;
  decisions?: string;
  status: 'scheduled' | 'completed';
  notes?: string;
  createdAt?: string;
}

export const COOP_ROLE_LABELS: Record<CoopMemberRole, string> = {
  president: 'رئيس التعاونية',
  vice_president: 'نائب الرئيس',
  treasurer: 'أمين المال',
  secretary: 'الكاتب العام',
  member: 'عضو منخرط',
};

export const COOP_MEMBER_STATUS_LABELS: Record<CoopMemberStatus, string> = {
  active: 'نشط',
  suspended: 'معلق',
  exited: 'منسحب',
};

export const COOP_TX_TYPE_LABELS: Record<CoopTxType, string> = {
  contribution: 'اشتراك / مساهمة منخرط',
  grant: 'دعم / منحة (INDH / فلاحي)',
  coop_sale: 'مبيعات جماعية للتعاونية',
  coop_expense: 'مشتريات جماعية (أعلاف / كتاكيت / معدات)',
  admin_expense: 'مصاريف تسيير وإدارة',
  profit_distribution: 'توزيع فائض وأرباح',
};

export const COOP_TX_CATEGORY_LABELS: Record<CoopTxCategory, string> = {
  shares: 'حصص وأسهم',
  feed: 'أعلاف جماعية',
  equipment: 'معدات وتجهيزات',
  eggs: 'تسويق البيض والدجاج',
  subsidy: 'دعم وشراكات',
  admin: 'تسيير ووثائق',
  other: 'أخرى',
};

export const COOP_PAYMENT_LABELS: Record<CoopPaymentMethod, string> = {
  cash: 'نقداً',
  bank: 'تحويل بنكي',
  check: 'شيك',
};

export const COOP_MEETING_TYPE_LABELS: Record<CoopMeetingType, string> = {
  general_ordinary: 'جمع عام عادي',
  general_extraordinary: 'جمع عام استثنائي',
  board_meeting: 'اجتماع المكتب المسير',
};

// === أنواع مساعدة ===
export interface MonthlyFlow {
  month: string;
  revenue: number;
  operationalExpenses: number;
  capitalExpenses: number;
  netFlow: number;
  cumulativeBalance: number;
}

export interface KPIData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  costPerEgg: number;
  feedPerEgg: number;
  activeHens: number;
  avgProductionRate: number;
  breakEvenEggs: number;
  breakEvenMonths: number;
  totalFoundationCost: number;
}

export const SALE_TYPE_LABELS: Record<SaleType, string> = {
  eggs: 'بيض',
  fertilizedEggs: 'بيض مخصب',
  chicks: 'كتاكيت',
  culledHens: 'دجاج مستبعد',
  manure: 'سماد',
  males: 'ذكور',
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  feed: 'أعلاف',
  medicine: 'أدوية',
  electricity: 'كهرباء',
  water: 'ماء',
  heating: 'تدفئة',
  equipment: 'معدات',
  bedding: 'فرشة',
  transport: 'نقل',
  cleaning: 'تنظيف وتطهير',
  vaccination: 'تحصينات',
  labor: 'عمالة',
  rent: 'إيجار',
  other: 'أخرى',
};

export const EXPENSE_SCOPE_LABELS: Record<ExpenseScope, string> = {
  general: 'عام',
  batch: 'مرتبط بدفعة',
  foundation: 'تأسيسي',
};

export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  operational: 'تشغيلي',
  capital: 'رأسمالي',
};

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  incubating: 'في الفقاسة',
  hatched: 'تم الفقس',
  transferred: 'تم النقل للتربية',
};

export const REARING_STATUS_LABELS: Record<RearingStatus, string> = {
  rearing: 'قيد التربية',
  completed: 'مكتمل',
  transferred: 'تم النقل للإنتاج',
};

// جدول التحصينات المدمج
export interface VaccinationSchedule {
  weekNumber: number;
  vaccineName: string;
  vaccineType: string;
  method: string;
  notes?: string;
}

export const DEFAULT_VACCINATION_SCHEDULE: VaccinationSchedule[] = [
  { weekNumber: 1, vaccineName: 'نيوكاسل + التهاب الشعب الهوائية', vaccineType: 'حي مضعف', method: 'رش أو ماء الشرب' },
  { weekNumber: 2, vaccineName: 'جامبورو (IBD)', vaccineType: 'حي مضعف', method: 'ماء الشرب' },
  { weekNumber: 3, vaccineName: 'نيوكاسل (تعزيزي)', vaccineType: 'حي مضعف', method: 'ماء الشرب' },
  { weekNumber: 4, vaccineName: 'جامبورو (تعزيزي)', vaccineType: 'حي مضعف', method: 'ماء الشرب' },
  { weekNumber: 6, vaccineName: 'جدري الدجاج', vaccineType: 'حي', method: 'وخز الجناح' },
  { weekNumber: 8, vaccineName: 'نيوكاسل (ثالث)', vaccineType: 'حي مضعف', method: 'ماء الشرب' },
  { weekNumber: 10, vaccineName: 'التهاب الشعب الهوائية (تعزيزي)', vaccineType: 'حي مضعف', method: 'ماء الشرب' },
  { weekNumber: 12, vaccineName: 'نيوكاسل + التهاب الشعب (رابع)', vaccineType: 'حي مضعف', method: 'ماء الشرب' },
  { weekNumber: 16, vaccineName: 'نيوكاسل زيتي (ميت)', vaccineType: 'ميت', method: 'حقن عضلي' },
  { weekNumber: 18, vaccineName: 'التهاب الشعب الهوائية (ما قبل البيض)', vaccineType: 'حي مضعف', method: 'ماء الشرب' },
];

// الفرضيات القياسية لمعايير الفقاسة
export const INCUBATOR_STANDARDS = {
  phase1: { // أيام 1-18
    days: '1-18',
    temperature: { min: 37.5, max: 37.8, target: 37.7 },
    humidity: { min: 50, max: 55 },
    turning: true,
  },
  phase2: { // أيام 19-21
    days: '19-21',
    temperature: { min: 37.2, max: 37.5 },
    humidity: { min: 65, max: 75 },
    turning: false,
  },
  checkpoints: {
    candling: 7,
    stopTurning: 18,
    expectedHatch: 21,
  },
};
