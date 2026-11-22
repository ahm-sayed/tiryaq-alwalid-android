export type MedicineType =
  | 'أقراص'
  | 'كبسولات'
  | 'شريط'
  | 'شراب / مل'
  | 'حقن / أمبول'
  | 'بخاخ'
  | 'أخرى';

export type CourseType = 'chronic' | 'fixed';

export const DEFAULT_RENEWAL_ALERT_LIMIT = 5;
export const RENEWAL_ALERT_LIMIT_OPTIONS = [1, 3, 5, 10] as const;
export const DEFAULT_STRIP_CAPACITY = 10;

export const WEEKDAYS_AR = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
] as const;

export interface RenewalAlert {
  triggerAt: number;
  title: string;
  body: string;
}

export interface Medicine {
  id: string;
  name: string;
  type: MedicineType | string;
  initialPills: number;
  stripCapacity?: number;
  actualStripPills?: number;
  dailyDose: number;
  startDate: string; // YYYY-MM-DD
  courseType: CourseType;
  offDays?: number[];
  courseDays: number | null;
  warningDays: number;
  renewalAlertLimit?: number;
  renewalAlertPlan?: RenewalAlert[];
  notes: string;
}

export interface CourseInfo {
  daysElapsed: number;
  totalCourse: number;
  courseRemainingDays: number;
  isCourseFinished: boolean;
}

export interface MedicationMetrics {
  daysElapsed: number;
  intakeDaysElapsed: number;
  intakeDaysRemaining: number;
  consumedPills: number;
  currentPills: number;
  initialPills: number;
  daysRemaining: number;
  refillDateFormatted: string;
  percentage: number;
  isUrgent: boolean;
  isDepleted: boolean;
  courseInfo: CourseInfo | null;
}

export const STORAGE_KEY = 'tiryaq_elderly_medicines_v4';

export function formatIsoDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getRenewalAlertLimit(med: Medicine): number {
  const limit = Number(med.renewalAlertLimit);
  return RENEWAL_ALERT_LIMIT_OPTIONS.some((option) => option === limit)
    ? limit
    : DEFAULT_RENEWAL_ALERT_LIMIT;
}

export function getStripCapacity(med: Medicine): number {
  const capacity = Number(med.stripCapacity);
  return Number.isFinite(capacity) && capacity > 0
    ? capacity
    : DEFAULT_STRIP_CAPACITY;
}

export function getActualStripPills(med: Medicine): number {
  const actual = Number(med.actualStripPills);
  return Number.isFinite(actual) && actual >= 0
    ? actual
    : getStripCapacity(med);
}

export function getStripDescription(med: Medicine): string | null {
  if (med.type !== 'شريط') return null;
  return `شريط حالي: ${getActualStripPills(med)} من ${getStripCapacity(med)} قرص`;
}

export function updateMedicineInventory(
  med: Medicine,
  initialPills: number,
  startDate: string,
  actualStripPills?: number
): Medicine {
  return {
    ...med,
    initialPills,
    startDate,
    renewalAlertPlan: [],
    ...(actualStripPills !== undefined ? { actualStripPills } : {}),
  };
}

export function getSavedRenewalAlertPlan(med: Medicine): RenewalAlert[] {
  if (!Array.isArray(med.renewalAlertPlan)) return [];
  return med.renewalAlertPlan.filter(
    (alert) =>
      !!alert &&
      typeof alert === 'object' &&
      Number.isFinite(alert.triggerAt) &&
      typeof alert.title === 'string' &&
      typeof alert.body === 'string'
  );
}

export function countIntakeDaysBetween(
  startDateExclusive: Date,
  endDateInclusive: Date,
  offDays: number[] = []
): number {
  const start = new Date(
    startDateExclusive.getFullYear(),
    startDateExclusive.getMonth(),
    startDateExclusive.getDate()
  );
  const end = new Date(
    endDateInclusive.getFullYear(),
    endDateInclusive.getMonth(),
    endDateInclusive.getDate()
  );
  const days = Math.max(
    0,
    Math.floor(
      (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
        Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
        86400000
    )
  );
  const skippedDays = new Set(
    offDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  );
  const intakeDaysPerWeek = 7 - skippedDays.size;
  const fullWeeks = Math.floor(days / 7);
  let intakeDays = fullWeeks * intakeDaysPerWeek;

  for (let offset = 0; offset < days % 7; offset++) {
    const weekday = (start.getDay() + offset + 1) % 7;
    if (!skippedDays.has(weekday)) intakeDays++;
  }

  return intakeDays;
}

export function getCalendarDaysUntilIntakes(
  startDateExclusive: Date,
  intakeCount: number,
  offDays: number[] = []
): number {
  const skippedDays = new Set(
    offDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  );
  const intakeDaysPerWeek = 7 - skippedDays.size;
  if (intakeCount <= 0 || intakeDaysPerWeek === 0) return 0;

  const fullWeeks = Math.floor((intakeCount - 1) / intakeDaysPerWeek);
  let remainingIntakes = intakeCount - fullWeeks * intakeDaysPerWeek;
  let calendarDays = fullWeeks * 7;

  for (let offset = 1; offset <= 7; offset++) {
    const weekday = (startDateExclusive.getDay() + calendarDays + offset) % 7;
    if (!skippedDays.has(weekday) && --remainingIntakes === 0) {
      return calendarDays + offset;
    }
  }

  return calendarDays;
}

export function getDefaultSampleMedicines(nowMs: number = Date.now()): Medicine[] {
  const dayMs = 86400000;
  return [
    {
      id: 'med_' + nowMs + '_1',
      name: 'كونكور 5 مجم (Concor)',
      type: 'أقراص',
      initialPills: 30,
      dailyDose: 1,
      // بدأ منذ 27 يوماً (متبقي 3 حبات -> يدخل في التنبيه العاجل)
      startDate: new Date(nowMs - 27 * dayMs).toISOString().split('T')[0],
      courseType: 'chronic',
      courseDays: null,
      warningDays: 3,
      notes: 'قرص واحد صباحاً بعد الإفطار لضغط الدم',
    },
    {
      id: 'med_' + nowMs + '_2',
      name: 'جلوكوفاج 1000 مجم (Glucophage)',
      type: 'أقراص',
      initialPills: 60,
      dailyDose: 2,
      // بدأ منذ 15 يوماً (متبقي 30 حبة تكفي 15 يوماً -> مستقر)
      startDate: new Date(nowMs - 15 * dayMs).toISOString().split('T')[0],
      courseType: 'chronic',
      courseDays: null,
      warningDays: 3,
      notes: 'قرص مع الغداء وقرص مع العشاء لضبط سكر الدم',
    },
    {
      id: 'med_' + nowMs + '_3',
      name: 'أوجمنتين 1 جم (Augmentin)',
      type: 'أقراص',
      initialPills: 14,
      dailyDose: 2,
      startDate: new Date(nowMs - 4 * dayMs).toISOString().split('T')[0],
      courseType: 'fixed',
      courseDays: 7,
      warningDays: 2,
      notes: 'مضاد حيوي كل 12 ساعة بعد الأكل لمدة 7 أيام',
    },
  ];
}

export function calculateMedicationMetrics(
  med: Medicine,
  referenceDate: Date = new Date()
): MedicationMetrics {
  const initialPills = Number(med.initialPills) || 30;
  const dailyDose = Number(med.dailyDose) || 1;
  const warningDays = Number(med.warningDays) || 3;

  const startParts = (med.startDate || formatIsoDate(referenceDate)).split('-');
  const startDate = new Date(
    parseInt(startParts[0], 10),
    parseInt(startParts[1], 10) - 1,
    parseInt(startParts[2], 10)
  );
  startDate.setHours(0, 0, 0, 0);

  const now = new Date(referenceDate.getTime());
  now.setHours(0, 0, 0, 0);

  const diffTime = now.getTime() - startDate.getTime();
  const daysElapsed = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  const offDays = med.courseType === 'chronic' ? med.offDays || [] : [];

  const intakeDaysElapsed = countIntakeDaysBetween(startDate, now, offDays);
  const consumedPills = Math.min(initialPills, +(intakeDaysElapsed * dailyDose).toFixed(2));

  // المتبقي الفعلي بالعلبة
  const currentPills = Math.max(0, +(initialPills - consumedPills).toFixed(2));

  // أيام الجرعات المتبقية، ثم موعد النفاد بالتقويم مع احتساب أيام الراحة
  const intakeDaysRemaining = dailyDose > 0 ? Math.floor(currentPills / dailyDose) : 0;
  const daysRemaining = getCalendarDaysUntilIntakes(now, intakeDaysRemaining, offDays);

  // تاريخ النفاد التقريبي
  const totalIntakeCapacity = dailyDose > 0 ? Math.floor(initialPills / dailyDose) : 0;
  const depletionDate = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate() + getCalendarDaysUntilIntakes(startDate, totalIntakeCapacity, offDays)
  );
  const refillDateFormatted = depletionDate.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const percentage =
    initialPills > 0
      ? Math.min(100, Math.max(0, Math.round((currentPills / initialPills) * 100)))
      : 0;
  const isDepleted = currentPills <= 0;
  const isUrgent = isDepleted || daysRemaining <= warningDays;

  let courseInfo: CourseInfo | null = null;
  if (med.courseType === 'fixed' && med.courseDays) {
    const totalCourse = parseInt(String(med.courseDays), 10);
    const courseDaysRemaining = Math.max(0, totalCourse - daysElapsed);
    const isCourseFinished = daysElapsed >= totalCourse;
    courseInfo = {
      daysElapsed,
      totalCourse,
      courseRemainingDays: courseDaysRemaining,
      isCourseFinished,
    };
  }

  return {
    daysElapsed,
    intakeDaysElapsed,
    intakeDaysRemaining,
    consumedPills,
    currentPills,
    initialPills,
    daysRemaining,
    refillDateFormatted,
    percentage,
    isUrgent,
    isDepleted,
    courseInfo,
  };
}

export function buildRenewalAlertPlan(
  med: Medicine,
  referenceDate: Date = new Date()
): RenewalAlert[] {
  const savedPlan = getSavedRenewalAlertPlan(med);
  const alertLimit = getRenewalAlertLimit(med);
  let remainingSlots = alertLimit - savedPlan.length;
  if (remainingSlots <= 0) return savedPlan;

  const metrics = calculateMedicationMetrics(med, referenceDate);
  if (metrics.courseInfo?.isCourseFinished) return savedPlan;

  const now = referenceDate.getTime();
  const alerts = [...savedPlan];
  const addAlert = (triggerAt: number, title: string, body: string) => {
    if (remainingSlots <= 0 || triggerAt <= now + 60000) return;
    alerts.push({ triggerAt, title, body });
    remainingSlots--;
  };

  const urgentBody = metrics.isDepleted
    ? `تنبيه عاجل جداً: دواء (${med.name}) نفد تماماً! اشترِ العلبة للوالد فوراً.`
    : `تنبيه عاجل: دواء (${med.name}) سينفد خلال ${metrics.daysRemaining} يوم (متبقي ${metrics.currentPills} كبسولة).`;

  if (metrics.isUrgent) {
    addAlert(
      new Date(Math.ceil((now + 15 * 60 * 1000) / 60000) * 60000).getTime(),
      'ترياق الوالد | تذكير عاجل بشراء الدواء!',
      urgentBody
    );
    addAlert(
      new Date(Math.ceil((now + 2 * 60 * 60 * 1000) / 60000) * 60000).getTime(),
      'ترياق الوالد | تذكير عاجل بشراء الدواء!',
      urgentBody
    );

    for (let dayOffset = 0; dayOffset <= 21 && remainingSlots > 0; dayOffset++) {
      for (const [hour, minute] of [
        [10, 0],
        [14, 0],
        [18, 0],
        [21, 30],
      ]) {
        const targetTime = new Date(
          referenceDate.getFullYear(),
          referenceDate.getMonth(),
          referenceDate.getDate() + dayOffset,
          hour,
          minute,
          0
        );
        addAlert(
          targetTime.getTime(),
          'ترياق الوالد | موعد تجديد وشراء دواء!',
          urgentBody
        );
        if (remainingSlots <= 0) break;
      }
    }
  } else {
    const daysUntilWarning = Math.max(1, metrics.daysRemaining - (med.warningDays || 3));
    const maxDayOffset = Math.min(daysUntilWarning + 21, metrics.daysRemaining + 14);

    for (let dayOffset = daysUntilWarning; dayOffset <= maxDayOffset && remainingSlots > 0; dayOffset++) {
      for (const [hour, minute] of [
        [10, 0],
        [14, 0],
        [18, 0],
        [21, 30],
      ]) {
        const targetTime = new Date(
          referenceDate.getFullYear(),
          referenceDate.getMonth(),
          referenceDate.getDate() + dayOffset,
          hour,
          minute,
          0
        );
        const intakeDaysPassed = countIntakeDaysBetween(
          referenceDate,
          targetTime,
          med.courseType === 'chronic' ? med.offDays : []
        );
        const remainingAtDay = Math.max(0, metrics.intakeDaysRemaining - intakeDaysPassed);
        addAlert(
          targetTime.getTime(),
          'ترياق الوالد | تنبيه تجديد دواء الوالد!',
          remainingAtDay <= 0
            ? `تنبيه عاجل: دواء (${med.name}) ينفد اليوم! يرجى شراء علبة جديدة للوالد.`
            : `تذكير مسبق: دواء (${med.name}) سينفد خلال ${remainingAtDay} يوم. يرجى شراء علبة جديدة.`
        );
        if (remainingSlots <= 0) break;
      }
    }
  }

  return alerts.length === savedPlan.length
    ? savedPlan
    : alerts.sort((a, b) => a.triggerAt - b.triggerAt);
}

export function getUrgentMedicinesList(
  medicines: Medicine[],
  referenceDate: Date = new Date()
): Array<{ id: string; name: string; days: number; pills: number; isDepleted: boolean }> {
  const urgentMeds: Array<{
    id: string;
    name: string;
    days: number;
    pills: number;
    isDepleted: boolean;
  }> = [];

  for (const med of medicines) {
    const metrics = calculateMedicationMetrics(med, referenceDate);
    if (metrics.courseInfo && metrics.courseInfo.isCourseFinished) continue;
    if (metrics.isUrgent) {
      urgentMeds.push({
        id: med.id,
        name: med.name,
        days: metrics.daysRemaining,
        pills: metrics.currentPills,
        isDepleted: metrics.isDepleted,
      });
    }
  }

  return urgentMeds;
}

export function calculatePortfolioStats(
  medicines: Medicine[],
  referenceDate: Date = new Date()
) {
  const totalMeds = medicines.length;
  let urgentCount = 0;
  let totalPills = 0;
  let chronicCount = 0;
  let safeCount = 0;

  for (const m of medicines) {
    const metrics = calculateMedicationMetrics(m, referenceDate);
    totalPills += metrics.currentPills;
    if (metrics.isUrgent) urgentCount++;
    else safeCount++;
    if (m.courseType !== 'fixed') chronicCount++;
  }

  return {
    totalMeds,
    urgentCount,
    totalPills: Math.round(totalPills),
    chronicCount,
    safeCount,
  };
}
