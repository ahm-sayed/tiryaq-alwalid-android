import React, { useState, useEffect, useRef } from 'react';
import {
  calculateMedicationMetrics,
  calculateRefillResult,
  DEFAULT_PACK_SIZE,
  DEFAULT_RENEWAL_ALERT_LIMIT,
  formatIsoDate,
  getDefaultPackSizeForType,
  getPackSize,
  getRenewalAlertLimit,
  RENEWAL_ALERT_LIMIT_OPTIONS,
  resolveMedicineFormInventory,
  WEEKDAYS_AR,
  type CourseType,
  type Medicine,
} from '../utils/medicationLogic';

function formatMultiplierLabel(type: string, multiplier: number, total: number): string {
  if (type === 'شريط') {
    if (multiplier === 1) return `شريط (${total})`;
    if (multiplier === 2) return `شريطين (${total})`;
    return `${multiplier} شرائط (${total})`;
  }
  return `×${multiplier} (${total})`;
}

interface AddEditModalProps {
  isOpen: boolean;
  editingMedicine: Medicine | null;
  onClose: () => void;
  onSave: (medData: Omit<Medicine, 'id'>, existingId?: string) => void;
}

export const MedicineFormModal: React.FC<AddEditModalProps> = ({
  isOpen,
  editingMedicine,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('أقراص');
  const [packSize, setPackSize] = useState<string>(String(DEFAULT_PACK_SIZE));
  const [hasCustomPackSize, setHasCustomPackSize] = useState<boolean>(false);
  const [isOpened, setIsOpened] = useState<boolean>(false);
  const [openedRemaining, setOpenedRemaining] = useState<string>('');
  const [dailyDose, setDailyDose] = useState<string>('1');
  const [startDate, setStartDate] = useState<string>(formatIsoDate());
  const [courseType, setCourseType] = useState<CourseType>('chronic');
  const [courseDays, setCourseDays] = useState<string>('');
  const [offDays, setOffDays] = useState<number[]>([]);
  const [warningDays, setWarningDays] = useState<number>(3);
  const [renewalAlertLimit, setRenewalAlertLimit] = useState<number>(
    DEFAULT_RENEWAL_ALERT_LIMIT
  );
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const packSizeInputRef = useRef<HTMLInputElement | null>(null);
  const openedRemainingInputRef = useRef<HTMLInputElement | null>(null);
  const dailyDoseInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const today = formatIsoDate();
    setFormError(null);
    if (editingMedicine) {
      const savedPackSize = getPackSize(editingMedicine);
      const differsFromPack = editingMedicine.initialPills !== savedPackSize;
      setName(editingMedicine.name);
      setType(editingMedicine.type || 'أقراص');
      setPackSize(String(savedPackSize));
      setHasCustomPackSize(true);
      setIsOpened(differsFromPack);
      setOpenedRemaining(String(editingMedicine.initialPills));
      setDailyDose(String(editingMedicine.dailyDose || 1));
      setStartDate(editingMedicine.startDate || today);
      const editingCourseType = editingMedicine.courseType || 'chronic';
      setCourseType(editingCourseType);
      setCourseDays(editingMedicine.courseDays ? String(editingMedicine.courseDays) : '');
      setOffDays(editingCourseType === 'chronic' ? editingMedicine.offDays || [] : []);
      setWarningDays(editingMedicine.warningDays || 3);
      setRenewalAlertLimit(getRenewalAlertLimit(editingMedicine));
      setNotes(editingMedicine.notes || '');
    } else {
      setName('');
      setType('أقراص');
      setPackSize(String(DEFAULT_PACK_SIZE));
      setHasCustomPackSize(false);
      setIsOpened(false);
      setOpenedRemaining('');
      setDailyDose('1');
      setStartDate(today);
      setCourseType('chronic');
      setCourseDays('');
      setOffDays([]);
      setWarningDays(3);
      setRenewalAlertLimit(DEFAULT_RENEWAL_ALERT_LIMIT);
      setNotes('');
    }
  }, [isOpen, editingMedicine]);

  if (!isOpen) return null;

  const handleTypeChange = (nextType: string) => {
    setType(nextType);
    if (!editingMedicine && !hasCustomPackSize) {
      setPackSize(String(getDefaultPackSizeForType(nextType)));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const parsedPackSize = parseFloat(packSize);
    const parsedOpenedRemaining = parseFloat(openedRemaining);
    const parsedDose = parseFloat(dailyDose);

    if (!trimmedName) {
      setFormError('يرجى إدخال اسم الدواء.');
      return;
    }

    if (!Number.isFinite(parsedPackSize) || parsedPackSize <= 0) {
      setFormError('يرجى إدخال سعة كاملة صالحة للشريط أو العبوة (أكبر من صفر).');
      packSizeInputRef.current?.focus();
      return;
    }

    const inventory = resolveMedicineFormInventory(
      parsedPackSize,
      isOpened,
      isOpened ? parsedOpenedRemaining : undefined
    );
    if (!inventory) {
      setFormError('يرجى إدخال الكمية المتبقية حالياً في الدواء المفتوح (أكبر من صفر).');
      openedRemainingInputRef.current?.focus();
      return;
    }

    if (!Number.isFinite(parsedDose) || parsedDose <= 0) {
      setFormError('يرجى إدخال معدل استهلاك يومي صالح (أكبر من صفر).');
      dailyDoseInputRef.current?.focus();
      return;
    }

    setFormError(null);
    onSave(
      {
        name: trimmedName,
        type,
        packSize: inventory.packSize,
        initialPills: inventory.initialPills,
        dailyDose: parsedDose,
        startDate: startDate || formatIsoDate(),
        courseType,
        offDays: courseType === 'chronic' ? offDays : [],
        courseDays: courseType === 'fixed' ? parseInt(courseDays, 10) || 7 : null,
        warningDays,
        renewalAlertLimit,
        notes: notes.trim(),
      },
      editingMedicine?.id
    );
  };

  return (
    <div
      id="medicineModal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modalTitle"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all my-8">
        {/* ترويسة النافذة */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-clock-rotate-left text-xl"></i>
            <h2 id="modalTitle" className="text-base sm:text-lg font-extrabold">
              {editingMedicine
                ? `تعديل بيانات دواء: ${editingMedicine.name}`
                : 'إضافة دواء جديد للوالد (حساب تلقائي)'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة الدواء"
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* نموذج البيانات التلقائي */}
        <form
          id="medicineForm"
          aria-labelledby="modalTitle"
          onSubmit={handleSubmit}
          className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
        >
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-2xl text-xs flex items-center gap-2.5 font-semibold">
            <i className="fa-solid fa-circle-check text-emerald-600 text-base shrink-0"></i>
            <span>
              حساب ذاتي 100%: التطبيق يحفظ السعة الكاملة للشريط أو العبوة عند التجديد، ويمكنك إدخال
              الكمية المتبقية فقط إذا كان الدواء مفتوحاً الآن.
            </span>
          </div>

          {formError && (
            <div
              role="alert"
              className="bg-rose-50 border border-rose-300 text-rose-800 px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2"
            >
              <i className="fa-solid fa-circle-exclamation text-rose-600 shrink-0"></i>
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label htmlFor="medName" className="block text-xs font-bold text-slate-700">
                اسم الدواء والتركيز <span className="text-rose-500" aria-hidden="true">*</span>
              </label>
              <input
                type="text"
                id="medName"
                name="name"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="مثلاً: كونكور 5 مجم (Concor)"
                className="w-full min-h-11 px-3.5 py-2.5 rounded-xl border border-slate-300 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-200 text-sm font-semibold outline-none"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="medType" className="block text-xs font-bold text-slate-700">
                نوع المستحضر
              </label>
              <select
                id="medType"
                name="type"
                value={type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full min-h-11 px-3 py-2.5 rounded-xl border border-slate-300 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-200 text-sm font-semibold outline-none bg-white"
              >
                <option value="أقراص">أقراص</option>
                <option value="كبسولات">كبسولات</option>
                <option value="شريط">شريط</option>
                <option value="شراب / مل">شراب / مل</option>
                <option value="حقن / أمبول">حقن / أمبول</option>
                <option value="بخاخ">بخاخ</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div className="space-y-1">
              <label htmlFor="medPackSize" className="block text-xs font-bold text-slate-800">
                الكمية الكاملة في الشريط / العبوة (كمية التجديد){' '}
                <span className="text-rose-500" aria-hidden="true">*</span>
              </label>
              <input
                ref={packSizeInputRef}
                type="number"
                id="medPackSize"
                name="packSize"
                inputMode="decimal"
                min="0.5"
                step="0.5"
                required
                aria-describedby="medPackSizeHelp"
                value={packSize}
                onChange={(e) => {
                  setPackSize(e.target.value);
                  setHasCustomPackSize(true);
                  if (formError) setFormError(null);
                }}
                placeholder={type === 'شريط' ? 'مثلاً 10 أقراص' : 'مثلاً 30 حبة'}
                className="w-full min-h-11 px-3 py-2.5 rounded-xl border-2 border-emerald-300 bg-white focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-200 text-sm font-black text-emerald-800 outline-none"
              />
              <span id="medPackSizeHelp" className="text-[10px] text-slate-500 block">
                العدد الكامل في الشريط أو العبوة الجديدة — سيضيفه التطبيق تلقائياً عند التجديد.
              </span>
            </div>

            <div className="space-y-1">
              <label htmlFor="medDailyDose" className="block text-xs font-bold text-slate-800">
                معدل الاستهلاك اليومي <span className="text-rose-500" aria-hidden="true">*</span>
              </label>
              <input
                ref={dailyDoseInputRef}
                type="number"
                id="medDailyDose"
                name="dailyDose"
                inputMode="decimal"
                min="0.25"
                step="0.25"
                required
                aria-describedby="medDailyDoseHelp"
                value={dailyDose}
                onChange={(e) => {
                  setDailyDose(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="مثلاً: 1 أو 2"
                className="w-full min-h-11 px-3 py-2.5 rounded-xl border border-slate-300 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-200 text-sm font-black outline-none bg-white"
              />
              <span id="medDailyDoseHelp" className="text-[10px] text-slate-500 block">
                كم قرص / جرعة يتناولها الوالد يومياً
              </span>
            </div>
          </div>

          <div className="bg-violet-50 p-3.5 rounded-2xl border border-violet-200 space-y-3">
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                id="medIsOpened"
                name="isOpened"
                checked={isOpened}
                aria-expanded={isOpened}
                aria-controls="openedRemainingGroup"
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsOpened(checked);
                  if (checked && !openedRemaining && editingMedicine) {
                    setOpenedRemaining(String(editingMedicine.initialPills));
                  }
                  if (formError) setFormError(null);
                }}
                className="mt-0.5 w-5 h-5 rounded accent-violet-700 cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"
              />
              <label htmlFor="medIsOpened" className="cursor-pointer select-none flex-1">
                <span className="block text-xs font-extrabold text-violet-950">
                  {editingMedicine
                    ? 'رصيد بداية هذه الدورة مختلف عن السعة الكاملة (مفتوح / معدّل)'
                    : 'الدواء مفتوح حالياً (بدأ الاستخدام منه بالفعل)'}
                </span>
                <span className="text-[11px] text-violet-800 block mt-0.5">
                  فعّل هذا الخيار لإدخال الكمية المتبقية الفعلية الآن مع احتفاظ التطبيق بالسعة الكاملة أعلاه عند التجديد.
                </span>
              </label>
            </div>

            {isOpened && (
              <div
                id="openedRemainingGroup"
                className="pt-2.5 border-t border-violet-200/80 space-y-1"
              >
                <label
                  htmlFor="medOpenedRemaining"
                  className="block text-xs font-bold text-violet-950"
                >
                  {editingMedicine ? 'رصيد بداية الدورة الحالية' : 'الكمية المتبقية حالياً'}{' '}
                  <span className="text-rose-500" aria-hidden="true">*</span>
                </label>
                <input
                  ref={openedRemainingInputRef}
                  type="number"
                  id="medOpenedRemaining"
                  name="openedRemaining"
                  inputMode="decimal"
                  min="0.5"
                  step="0.5"
                  required={isOpened}
                  aria-describedby="medOpenedRemainingHelp"
                  value={openedRemaining}
                  onChange={(e) => {
                    setOpenedRemaining(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="مثلاً: 4 أو 6"
                  className="w-full min-h-11 px-3 py-2.5 rounded-xl border-2 border-violet-300 bg-white focus-visible:border-violet-600 focus-visible:ring-2 focus-visible:ring-violet-200 text-sm font-black text-violet-900 outline-none"
                />
                <span id="medOpenedRemainingHelp" className="text-[10px] text-violet-700 block">
                  سيبدأ العد التلقائي من هذا الرقم، وعند التجديد سيضيف التطبيق ({packSize || '—'}) تلقائياً.
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="medStartDate" className="block text-xs font-bold text-slate-700">
                تاريخ بدء هذه العلبة <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                id="medStartDate"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-sm font-semibold outline-none"
              />
              <span className="text-[10px] text-slate-400">
                اليوم الذي بدأ فيه الوالد تناول أول حبة من هذه العلبة
              </span>
            </div>

            <div className="space-y-1">
              <label htmlFor="medCourseType" className="block text-xs font-bold text-slate-700">
                طبيعة العلاج
              </label>
              <select
                id="medCourseType"
                value={courseType}
                onChange={(e) => {
                  const nextCourseType = e.target.value as CourseType;
                  setCourseType(nextCourseType);
                  if (nextCourseType === 'fixed') setOffDays([]);
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-sm font-semibold outline-none bg-white"
              >
                <option value="chronic">علاج دائم / مزمن (مستمر دائماً)</option>
                <option value="fixed">كورس محدد المدة (أيام محددة ثم توقف)</option>
              </select>
            </div>
          </div>

          {courseType === 'chronic' && (
            <div className="space-y-2 bg-sky-50 p-3.5 rounded-2xl border border-sky-200">
              <div>
                <span className="block text-xs font-bold text-sky-950">
                  أيام الراحة الأسبوعية (اختياري)
                </span>
                <span className="text-[11px] text-sky-800">
                  حدد يوماً أو يومين لا يتناول فيهما الدواء أسبوعياً.
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {WEEKDAYS_AR.map((dayName, day) => {
                  const isOffDay = offDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={isOffDay}
                      disabled={!isOffDay && offDays.length >= 2}
                      onClick={() =>
                        setOffDays((current) =>
                          current.includes(day)
                            ? current.filter((selectedDay) => selectedDay !== day)
                            : [...current, day].sort((a, b) => a - b)
                        )
                      }
                      className={`p-2 rounded-xl border text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed ${
                        isOffDay
                          ? 'bg-sky-700 text-white border-sky-700'
                          : 'bg-white text-sky-900 border-sky-200 hover:bg-sky-100'
                      }`}
                    >
                      {dayName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {courseType === 'fixed' && (
            <div className="bg-purple-50 p-3.5 rounded-2xl border border-purple-200 space-y-1">
              <label
                htmlFor="medCourseDays"
                className="block text-xs font-bold text-purple-900"
              >
                مدة الكورس الإجمالية (عدد أيام العلاج المطلوبة)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  id="medCourseDays"
                  min="1"
                  required
                  value={courseDays}
                  onChange={(e) => setCourseDays(e.target.value)}
                  placeholder="مثلاً: 7 أو 14 يوماً"
                  className="w-full px-3 py-2 rounded-xl border border-purple-300 focus:border-purple-500 text-sm font-bold outline-none bg-white"
                />
                <span className="text-xs font-bold text-purple-800 shrink-0">يوماً</span>
              </div>
              <span className="text-[11px] text-purple-700 block">
                سينبهك التطبيق تلقائياً عند انقضاء هذه الأيام لإيقاف العلاج.
              </span>
            </div>
          )}

          <div className="space-y-1 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <span className="block text-xs font-bold text-slate-800">
              بدء الرنين والتنبيه المسبق قبل موعد النفاد بـ:
            </span>
            <div className="grid grid-cols-4 gap-2 pt-1">
              {[
                { val: 1, label: 'قبل يوم' },
                { val: 2, label: 'قبل يومين' },
                { val: 3, label: 'قبل 3 أيام' },
                { val: 5, label: 'قبل 5 أيام' },
              ].map((item) => (
                <label
                  key={item.val}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border cursor-pointer text-xs font-bold transition ${
                    warningDays === item.val
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="warningDays"
                    value={item.val}
                    checked={warningDays === item.val}
                    onChange={() => setWarningDays(item.val)}
                    className="hidden"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2 bg-amber-50 p-3.5 rounded-2xl border border-amber-200">
            <div>
              <span className="block text-xs font-bold text-amber-950">
                عدد تنبيهات تجديد الدواء
              </span>
              <span className="text-[11px] text-amber-800">
                يُجدول هذا العدد كحد أقصى، ثم يتوقف التذكير حتى تجدد المخزون أو تصححه. يرن كل تنبيه لمدة محدودة.
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {RENEWAL_ALERT_LIMIT_OPTIONS.map((limit) => (
                <button
                  key={limit}
                  type="button"
                  aria-pressed={renewalAlertLimit === limit}
                  onClick={() => setRenewalAlertLimit(limit)}
                  className={`p-2 rounded-xl border text-xs font-bold transition ${
                    renewalAlertLimit === limit
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-amber-900 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  {limit} {limit === 1 ? 'تنبيه' : 'تنبيهات'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="medNotes" className="block text-xs font-bold text-slate-700">
              ملاحظات وتعليمات الطبيب للوالد
            </label>
            <textarea
              id="medNotes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثلاً: قرص بعد الإفطار، وسط كوب ماء، لا يؤخذ مع منتجات الألبان..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-sm font-medium outline-none resize-none"
            ></textarea>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs sm:text-sm hover:bg-slate-50 transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm shadow-md transition flex items-center gap-2"
            >
              <i className="fa-solid fa-floppy-disk"></i>
              <span>حفظ وتفعيل الحساب التلقائي</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface QuickRefillModalProps {
  medicine: Medicine | null;
  onClose: () => void;
  onConfirm: (medId: string, addedAmount: number, carryOver: boolean) => void;
}

export const QuickRefillModal: React.FC<QuickRefillModalProps> = ({
  medicine,
  onClose,
  onConfirm,
}) => {
  const [packCount, setPackCount] = useState<string>(String(DEFAULT_PACK_SIZE));
  const [carryOver, setCarryOver] = useState<boolean>(true);
  const [refillError, setRefillError] = useState<string | null>(null);
  const refillInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (medicine) {
      setPackCount(String(getPackSize(medicine)));
      setCarryOver(true);
      setRefillError(null);
    }
  }, [medicine]);

  if (!medicine) return null;

  const standardPackSize = getPackSize(medicine);
  const metrics = calculateMedicationMetrics(medicine);
  const parsedAmount = parseFloat(packCount);
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const preview = isValidAmount
    ? calculateRefillResult(medicine, parsedAmount, carryOver)
    : null;

  const handleConfirm = () => {
    if (!isValidAmount) {
      setRefillError('يرجى إدخال كمية تجديد صالحة (أكبر من صفر).');
      refillInputRef.current?.focus();
      return;
    }
    setRefillError(null);
    onConfirm(medicine.id, parsedAmount, carryOver);
  };

  return (
    <div
      id="quickRefillModal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quickRefillTitle"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden p-6 space-y-4">
        <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-inner">
          <i className="fa-solid fa-cart-shopping"></i>
        </div>
        <div className="text-center">
          <h3 id="quickRefillTitle" className="text-lg font-black text-slate-900">
            تجديد الدواء (شراء جديد)
          </h3>
          <p className="text-sm font-bold text-emerald-600 mt-1">{medicine.name}</p>
          <p className="text-xs text-slate-500 mt-1">
            سيتم بدء احتساب الدورة الجديدة من اليوم بإضافة كمية التجديد المحددة.
          </p>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
          <div className="space-y-1.5">
            <span className="block text-xs font-bold text-slate-700">
              اختيار سريع حسب السعة الكاملة ({standardPackSize}):
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((multiplier) => {
                const total = +(standardPackSize * multiplier).toFixed(2);
                const isSelected = isValidAmount && Math.abs(parsedAmount - total) < 0.001;
                return (
                  <button
                    key={multiplier}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setPackCount(String(total));
                      if (refillError) setRefillError(null);
                    }}
                    className={`min-h-11 px-2 py-2 rounded-xl border text-xs font-extrabold transition ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50 hover:border-emerald-300'
                    }`}
                  >
                    {formatMultiplierLabel(medicine.type, multiplier, total)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="refillPillCountInput"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              الكمية المضافة عند التجديد:
            </label>
            <input
              ref={refillInputRef}
              type="number"
              id="refillPillCountInput"
              name="refillAmount"
              inputMode="decimal"
              min="0.5"
              step="0.5"
              aria-describedby="refillPackSizeHint"
              aria-invalid={refillError ? 'true' : undefined}
              value={packCount}
              onChange={(e) => {
                setPackCount(e.target.value);
                if (refillError) setRefillError(null);
              }}
              className="w-full min-h-11 px-3 py-2.5 rounded-xl border border-slate-300 font-black text-slate-800 text-center text-lg focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-200 outline-none bg-white"
            />
            <span id="refillPackSizeHint" className="text-[10px] text-slate-500 block mt-1 text-center">
              السعة الكاملة المحفوظة: {standardPackSize} (تبقى محفوظة للتجديدات القادمة)
            </span>
          </div>

          {refillError && (
            <p role="alert" className="text-xs font-bold text-rose-700 text-center">
              {refillError}
            </p>
          )}

          {metrics.currentPills > 0 && (
            <div className="flex items-center gap-2.5 pt-2 border-t border-slate-200 text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                id="carryOverRemaining"
                name="carryOverRemaining"
                checked={carryOver}
                onChange={(e) => setCarryOver(e.target.checked)}
                className="w-5 h-5 rounded accent-emerald-600 cursor-pointer shrink-0"
              />
              <label htmlFor="carryOverRemaining" className="cursor-pointer">
                إضافة المتبقي السابق ({metrics.currentPills}) إلى الرصيد الجديد
              </label>
            </div>
          )}

          {preview && (
            <div
              aria-live="polite"
              className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-center"
            >
              <span className="text-xs font-extrabold text-emerald-900 block">
                الرصيد بعد التجديد: {preview.totalStartingPills}
              </span>
              {preview.carriedOverPills > 0 && (
                <span className="text-[11px] font-semibold text-emerald-700 block mt-0.5">
                  ({preview.addedAmount} جديدة + {preview.carriedOverPills} متبقي سابق)
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-1/2 min-h-11 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-xs hover:bg-slate-50 transition"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="w-1/2 min-h-11 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-1.5"
          >
            <i className="fa-solid fa-check"></i>
            <span>تأكيد التجديد الآن</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface AdjustBalanceModalProps {
  medicine: Medicine | null;
  onClose: () => void;
  onConfirm: (medId: string, actualCount: number) => void;
}

export const AdjustBalanceModal: React.FC<AdjustBalanceModalProps> = ({
  medicine,
  onClose,
  onConfirm,
}) => {
  const [actualCount, setActualCount] = useState<string>('0');

  useEffect(() => {
    if (medicine) {
      const metrics = calculateMedicationMetrics(medicine);
      setActualCount(String(metrics.currentPills));
    }
  }, [medicine]);

  if (!medicine) return null;

  return (
    <div
      id="adjustModal"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden p-6 space-y-4">
        <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-inner">
          <i className="fa-solid fa-sliders"></i>
        </div>
        <div className="text-center">
          <h3 className="text-lg font-black text-slate-900">تصحيح الرصيد ومزامنة الواقع</h3>
          <p className="text-sm font-bold text-amber-600 mt-1">{medicine.name}</p>
          <p className="text-xs text-slate-500 mt-1">
            إذا سقطت حبة أو فوّت الوالد جرعة، أدخل العدد الفعلي الموجود في العلبة وسيعاد ضبط الحساب
            التلقائي فوراً.
          </p>
        </div>

        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 space-y-2">
          <label
            htmlFor="adjustRealCountInput"
            className="block text-xs font-bold text-amber-900"
          >
            كم حبة موجودة بالعلبة فعلياً في يدك الآن؟
          </label>
          <input
            type="number"
            id="adjustRealCountInput"
            name="actualCount"
            inputMode="decimal"
            min="0"
            step="0.5"
            aria-describedby="adjustPackSizeKeepHint"
            value={actualCount}
            onChange={(e) => setActualCount(e.target.value)}
            className="w-full min-h-11 px-3 py-2.5 rounded-xl border border-amber-300 font-black text-slate-900 text-center text-xl focus-visible:border-amber-500 outline-none bg-white"
          />
          <span id="adjustPackSizeKeepHint" className="text-[11px] text-amber-700 block text-center">
            سيُستأنف الحساب التلقائي من هذا العدد بدءاً من اليوم، مع الاحتفاظ بسعة التجديد ({getPackSize(medicine)}) كما هي.
          </span>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-1/2 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-xs hover:bg-slate-50 transition"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => onConfirm(medicine.id, Math.max(0, parseFloat(actualCount) || 0))}
            className="w-1/2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-1.5"
          >
            <i className="fa-solid fa-arrows-rotate"></i>
            <span>تطبيق المزامنة فوراً</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface DeleteConfirmModalProps {
  medicine: Medicine | null;
  onClose: () => void;
  onConfirm: (medId: string) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  medicine,
  onClose,
  onConfirm,
}) => {
  if (!medicine) return null;

  return (
    <div
      id="deleteModal"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-100 p-6 text-center space-y-4">
        <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center text-2xl mx-auto">
          <i className="fa-solid fa-trash-can"></i>
        </div>
        <div>
          <h3 className="text-base font-extrabold text-slate-900">
            هل أنت متأكد من حذف هذا الدواء؟
          </h3>
          <p className="text-xs font-bold text-rose-600 mt-1">{medicine.name}</p>
          <p className="text-xs text-slate-500 mt-1">
            سيتم مسح بيانات الدواء نهائياً من الحساب والتنبيهات.
          </p>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-1/2 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
          >
            تراجع
          </button>
          <button
            type="button"
            onClick={() => onConfirm(medicine.id)}
            className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition"
          >
            نعم، حذف نهائي
          </button>
        </div>
      </div>
    </div>
  );
};
