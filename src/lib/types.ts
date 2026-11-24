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
  currentAgeWeeks?: number;     // عمر الدفعة بالأسابيع
  status: RearingStatus;
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

export interface Sale {
  id?: number;
  date: string;
  type: SaleType;
  quantity: number;
  unitType: UnitType;
  unitPrice: number;
  total: number;
  buyerName?: string;
  notes?: string;
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

// === خطة التوسع ===
export type ExpansionSource = 'incubator' | 'purchased';

export interface ExpansionPlanMonth {
  id?: number;
  planId: number;
  month: number; // 1-24
  addedHens: number;
  source: ExpansionSource;
  estimatedMortality: number;
  netActiveHens: number;
  requiredSpaceM2: number;
  monthlyFeedKg: number;
  feedCost: number;
  expectedEggProduction: number;
  expectedRevenue: number;
  operationalCost: number;
  expectedProfit: number;
  cumulativeProfit: number;
  selfFinancingGap: number;
}

export interface ExpansionPlan {
  id?: number;
  name: string;
  durationMonths: number; // 12 or 24
  startDate: string;
  createdAt: string;
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
