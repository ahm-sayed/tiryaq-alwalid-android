import React from 'react';
import {
  calculateMedicationMetrics,
  getRenewalAlertLimit,
  isStartedOpened,
  WEEKDAYS_AR,
  type Medicine,
} from '../utils/medicationLogic';

function getUnitLabel(type: string): string {
  switch (type) {
    case 'شريط':
    case 'أقراص':
      return 'قرص';
    case 'كبسولات':
      return 'كبسولة';
    case 'شراب / مل':
      return 'مل';
    case 'حقن / أمبول':
      return 'أمبول';
    case 'بخاخ':
      return 'بخة';
    default:
      return 'وحدة';
  }
}

interface MedicineCardProps {
  med: Medicine;
  onEdit: (medId: string) => void;
  onDelete: (medId: string) => void;
  onAdjust: (medId: string) => void;
  onRefill: (medId: string) => void;
}

export const MedicineCard: React.FC<MedicineCardProps> = ({
  med,
  onEdit,
  onDelete,
  onAdjust,
  onRefill,
}) => {
  const metrics = calculateMedicationMetrics(med);
  const unitLabel = getUnitLabel(med.type);
  const startedOpened = isStartedOpened(med);

  let cardBorderColor = 'border-slate-200';
  let statusBadgeBg = 'bg-emerald-100 text-emerald-800';
  let statusText = `آمن: باقي ${metrics.daysRemaining} يوم`;
  let progressColor = 'bg-emerald-500';

  if (metrics.isDepleted) {
    cardBorderColor = 'border-rose-400 ring-2 ring-rose-200';
    statusBadgeBg = 'bg-rose-600 text-white animate-pulse';
    statusText = 'نفد بالكامل! اشترِ الآن';
    progressColor = 'bg-rose-600';
  } else if (metrics.isUrgent) {
    cardBorderColor = 'border-amber-400 ring-2 ring-amber-100';
    statusBadgeBg = 'bg-rose-100 text-rose-700 font-extrabold';
    statusText = `تجديد عاجل: باقي ${metrics.daysRemaining} يوم`;
    progressColor = 'bg-amber-500';
  } else if (metrics.percentage <= 40) {
    progressColor = 'bg-amber-400';
  }

  return (
    <div
      className={`bg-white rounded-3xl p-5 border ${cardBorderColor} shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group`}
    >
      {metrics.isUrgent && (
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-rose-500"></div>
      )}

      <div>
        {/* ترويسة البطاقة */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                {med.type}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${statusBadgeBg}`}>
                {statusText}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                حساب تلقائي
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1.5 leading-snug">
              {med.name}
            </h3>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/70">
                سعة التجديد الكاملة: {metrics.packSize} {unitLabel}
              </span>
              {startedOpened && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-200">
                  بدأ مفتوحاً ({med.initialPills} من {metrics.packSize})
                </span>
              )}
            </div>
          </div>

          {/* خيارات الإدارة */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(med.id)}
              title={`تعديل بيانات ${med.name}`}
              aria-label={`تعديل بيانات ${med.name}`}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 flex items-center justify-center transition"
            >
              <i className="fa-solid fa-pen text-xs"></i>
            </button>
            <button
              type="button"
              onClick={() => onDelete(med.id)}
              title={`حذف ${med.name}`}
              aria-label={`حذف ${med.name}`}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition"
            >
              <i className="fa-solid fa-trash-can text-xs"></i>
            </button>
          </div>
        </div>

        {/* لوحة الحساب التلقائي الصارم بالأيام */}
        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-2 mb-3">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-slate-500 font-bold">المتبقي حالياً:</span>
            <span className="font-black text-slate-900 text-lg">
              {metrics.currentPills}{' '}
              <span className="text-xs text-slate-500 font-medium">
                / {metrics.referenceCapacity} {unitLabel}
              </span>
            </span>
          </div>

          {/* شريط التقدم اللوني التلقائي */}
          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
            <div
              className={`${progressColor} h-full rounded-full transition-all duration-500`}
              style={{ width: `${metrics.percentage}%` }}
            ></div>
          </div>

          {/* إحصائيات الاستهلاك */}
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 font-bold pt-1 border-t border-slate-200/60">
            <div>
              <span className="text-slate-400 font-normal">استهلك تلقائياً: </span>
              <span className="text-slate-800">
                {metrics.consumedPills} ({metrics.intakeDaysElapsed} يوم تناول)
              </span>
            </div>
            <div className="text-left">
              <span className="text-slate-400 font-normal">الجرعة: </span>
              <span className="text-slate-800">
                {med.dailyDose} حبة / {med.offDays && med.offDays.length > 0 ? 'يوم تناول' : 'يوم'}
              </span>
            </div>
          </div>
        </div>

        {/* تاريخ النفاد وميعاد الشراء التلقائي */}
        <div className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 text-slate-700 flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 font-bold">
            <i className="fa-solid fa-calendar-day text-emerald-600"></i>
            <span>موعد الشراء والتجديد:</span>
          </div>
          <span className="font-black text-slate-900">{metrics.refillDateFormatted}</span>
        </div>

        {/* أيام الراحة الأسبوعية */}
        {med.courseType === 'chronic' && med.offDays && med.offDays.length > 0 && (
          <div className="text-xs bg-sky-50 text-sky-900 p-2.5 rounded-xl border border-sky-200 mb-2">
            <span className="font-bold">أيام الراحة الأسبوعية: </span>
            {med.offDays
              .filter((day) => Number.isInteger(day) && day >= 0 && day < WEEKDAYS_AR.length)
              .map((day) => WEEKDAYS_AR[day])
              .join('، ')}
          </div>
        )}

        <div className="text-xs bg-amber-50 text-amber-900 p-2.5 rounded-xl border border-amber-200 mb-2 flex items-center justify-between gap-2">
          <span className="font-bold">تنبيهات التجديد:</span>
          <span className="font-semibold">
            {Math.min(med.renewalAlertPlan?.length || 0, getRenewalAlertLimit(med))} من{' '}
            {getRenewalAlertLimit(med)}
            {med.renewalAlertPlan &&
              med.renewalAlertPlan.length >= getRenewalAlertLimit(med) &&
              ' • اكتمل الجدول'}
          </span>
        </div>

        {/* تاريخ بدء العلبة */}
        <div className="text-[11px] text-slate-400 font-medium px-1 mb-2">
          بدأت هذه العلبة بتاريخ:{' '}
          <span className="text-slate-600 font-bold">{med.startDate}</span>
        </div>

        {/* ملاحظات الجرعة للوالد */}
        {med.notes && (
          <div className="text-xs bg-amber-50/70 text-amber-900 p-2.5 rounded-xl border border-amber-200/60 mb-2 flex items-start gap-2">
            <i className="fa-solid fa-note-sticky text-amber-600 mt-0.5 shrink-0"></i>
            <span className="leading-relaxed font-semibold">{med.notes}</span>
          </div>
        )}

        {/* كورس العلاج إن وجد */}
        {med.courseType === 'fixed' && metrics.courseInfo && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-center justify-between">
            <span className="font-bold">
              <i className="fa-solid fa-clock-rotate-left ml-1"></i> مدة الكورس (
              {metrics.courseInfo.totalCourse} أيام):
            </span>
            <span className="font-black text-purple-700">
              {metrics.courseInfo.isCourseFinished
                ? 'اكتملت مدة العلاج'
                : `انقضى ${metrics.courseInfo.daysElapsed} يوم • باقي ${metrics.courseInfo.courseRemainingDays} يوم`}
            </span>
          </div>
        )}
      </div>

      {/* أزرار الإجراءات التلقائية المريحة */}
      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={() => onAdjust(med.id)}
          title={`تصحيح الرصيد لـ ${med.name}`}
          aria-label={`تصحيح الرصيد لـ ${med.name}`}
          className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5 active:scale-95"
        >
          <i className="fa-solid fa-sliders text-amber-600"></i>
          <span>تصحيح الرصيد</span>
        </button>

        <button
          type="button"
          onClick={() => onRefill(med.id)}
          title={`تجديد دواء ${med.name}`}
          aria-label={`تجديد دواء ${med.name}`}
          className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm transition flex items-center justify-center gap-1.5 active:scale-95"
        >
          <i className="fa-solid fa-cart-shopping"></i>
          <span>تجديد الدواء</span>
        </button>
      </div>
    </div>
  );
};
