import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRenewalAlertPlan,
  calculateMedicationMetrics,
  calculatePortfolioStats,
  calculateRefillResult,
  DEFAULT_PACK_SIZE,
  DEFAULT_STRIP_CAPACITY,
  getDefaultPackSizeForType,
  getDefaultSampleMedicines,
  getPackSize,
  getRenewalAlertLimit,
  getUrgentMedicinesList,
  isStartedOpened,
  resolveMedicineFormInventory,
  updateMedicineInventory,
  type Medicine,
} from './medicationLogic';

test('calculateMedicationMetrics computes automatic consumption and urgent status accurately', () => {
  const refDate = new Date(2026, 10, 11); // Nov 11, 2026
  const startDate = '2026-10-15'; // 27 days earlier

  const concor: Medicine = {
    id: 'med_1',
    name: 'كونكور 5 مجم',
    type: 'أقراص',
    initialPills: 30,
    dailyDose: 1,
    startDate,
    courseType: 'chronic',
    courseDays: null,
    warningDays: 3,
    notes: 'صباحاً',
  };

  const metrics = calculateMedicationMetrics(concor, refDate);
  assert.equal(metrics.daysElapsed, 27);
  assert.equal(metrics.consumedPills, 27);
  assert.equal(metrics.currentPills, 3);
  assert.equal(metrics.daysRemaining, 3);
  assert.equal(metrics.percentage, 10);
  assert.equal(metrics.isUrgent, true);
  assert.equal(metrics.isDepleted, false);
});

test('calculateMedicationMetrics marks stable medicine as non-urgent when daysRemaining > warningDays', () => {
  const refDate = new Date(2026, 10, 11);
  const glucophage: Medicine = {
    id: 'med_2',
    name: 'جلوكوفاج 1000 مجم',
    type: 'أقراص',
    initialPills: 60,
    dailyDose: 2,
    startDate: '2026-10-27', // 15 days earlier
    courseType: 'chronic',
    courseDays: null,
    warningDays: 3,
    notes: '',
  };

  const metrics = calculateMedicationMetrics(glucophage, refDate);
  assert.equal(metrics.daysElapsed, 15);
  assert.equal(metrics.consumedPills, 30);
  assert.equal(metrics.currentPills, 30);
  assert.equal(metrics.daysRemaining, 15);
  assert.equal(metrics.isUrgent, false);
  assert.equal(metrics.isDepleted, false);
});

test('calculateMedicationMetrics excludes weekly off days from consumption and depletion reminders', () => {
  const medicine: Medicine = {
    id: 'med_weekly_break',
    name: 'دواء مزمن',
    type: 'أقراص',
    initialPills: 20,
    dailyDose: 1,
    startDate: '2026-11-01', // Sunday
    courseType: 'chronic',
    offDays: [5, 6], // Friday and Saturday
    courseDays: null,
    warningDays: 3,
    notes: '',
  };

  const metrics = calculateMedicationMetrics(medicine, new Date(2026, 10, 8));
  assert.equal(metrics.daysElapsed, 7);
  assert.equal(metrics.intakeDaysElapsed, 5);
  assert.equal(metrics.consumedPills, 5);
  assert.equal(metrics.currentPills, 15);
  assert.equal(metrics.intakeDaysRemaining, 15);
  assert.equal(metrics.daysRemaining, 21);
});

test('calculateMedicationMetrics preserves daily schedules for medicines without off days', () => {
  const medicine: Medicine = {
    id: 'med_legacy',
    name: 'دواء قديم',
    type: 'أقراص',
    initialPills: 30,
    dailyDose: 1,
    startDate: '2026-11-01',
    courseType: 'chronic',
    courseDays: null,
    warningDays: 3,
    notes: '',
  };

  const metrics = calculateMedicationMetrics(medicine, new Date(2026, 10, 8));
  assert.equal(metrics.consumedPills, 7);
  assert.equal(metrics.daysRemaining, 23);
});

test('buildRenewalAlertPlan caps actual scheduled alerts and keeps the cap across later scheduling', () => {
  const now = new Date(2026, 10, 17, 19);
  const medicine: Medicine = {
    id: 'med_alert_limit',
    name: 'دواء مزمن',
    type: 'أقراص',
    initialPills: 2,
    dailyDose: 1,
    startDate: '2026-11-10',
    courseType: 'chronic',
    courseDays: null,
    warningDays: 3,
    renewalAlertLimit: 3,
    notes: '',
  };

  const plan = buildRenewalAlertPlan(medicine, now);
  assert.equal(plan.length, 3);
  assert.ok(plan.every((alert) => alert.triggerAt > now.getTime()));
  assert.equal(getRenewalAlertLimit({ ...medicine, renewalAlertLimit: undefined }), 5);

  const afterAlerts = buildRenewalAlertPlan(
    { ...medicine, renewalAlertPlan: plan },
    new Date(2026, 11, 17)
  );
  assert.deepEqual(afterAlerts, plan);
});

test('updating medicine inventory clears the alert cap so reminders can be scheduled again', () => {
  const now = new Date(2026, 10, 17, 19);
  const medicine: Medicine = {
    id: 'med_refill_reset',
    name: 'دواء مزمن',
    type: 'أقراص',
    initialPills: 2,
    dailyDose: 1,
    startDate: '2026-11-10',
    courseType: 'chronic',
    courseDays: null,
    warningDays: 3,
    renewalAlertLimit: 3,
    notes: '',
  };
  const exhausted = {
    ...medicine,
    renewalAlertPlan: buildRenewalAlertPlan(medicine, now),
  };
  assert.equal(exhausted.renewalAlertPlan.length, 3);

  const refilled = updateMedicineInventory(exhausted, 30, '2026-11-17');
  assert.deepEqual(refilled.renewalAlertPlan, []);
  assert.equal(buildRenewalAlertPlan(refilled, now).length, 3);
});

test('calculateMedicationMetrics tracks fixed course completion and excludes finished courses from urgent alarms', () => {
  const refDate = new Date(2026, 10, 11);
  const finishedAntibiotic: Medicine = {
    id: 'med_3',
    name: 'أوجمنتين 1 جم',
    type: 'أقراص',
    initialPills: 14,
    dailyDose: 2,
    startDate: '2026-11-01', // 10 days earlier (> 7 day course)
    courseType: 'fixed',
    courseDays: 7,
    warningDays: 2,
    notes: '',
  };

  const metrics = calculateMedicationMetrics(finishedAntibiotic, refDate);
  assert.ok(metrics.courseInfo);
  assert.equal(metrics.courseInfo?.isCourseFinished, true);
  assert.equal(metrics.courseInfo?.courseRemainingDays, 0);

  const urgentList = getUrgentMedicinesList([finishedAntibiotic], refDate);
  assert.equal(urgentList.length, 0);
  assert.equal(buildRenewalAlertPlan(finishedAntibiotic, refDate).length, 0);
});

test('calculatePortfolioStats aggregates total, urgent, safe, chronic, and pill counts', () => {
  const refDate = new Date(2026, 10, 11);
  const meds: Medicine[] = [
    {
      id: 'm1',
      name: 'Concor',
      type: 'أقراص',
      initialPills: 30,
      dailyDose: 1,
      startDate: '2026-10-15', // 3 pills left -> urgent
      courseType: 'chronic',
      courseDays: null,
      warningDays: 3,
      notes: '',
    },
    {
      id: 'm2',
      name: 'Glucophage',
      type: 'أقراص',
      initialPills: 60,
      dailyDose: 2,
      startDate: '2026-10-27', // 30 pills left -> safe
      courseType: 'chronic',
      courseDays: null,
      warningDays: 3,
      notes: '',
    },
  ];

  const stats = calculatePortfolioStats(meds, refDate);
  assert.equal(stats.totalMeds, 2);
  assert.equal(stats.urgentCount, 1);
  assert.equal(stats.safeCount, 1);
  assert.equal(stats.totalPills, 33);
  assert.equal(stats.chronicCount, 2);
});

test('getDefaultPackSizeForType returns strip default for strips and standard default for other types', () => {
  assert.equal(getDefaultPackSizeForType('شريط'), DEFAULT_STRIP_CAPACITY);
  assert.equal(getDefaultPackSizeForType('أقراص'), DEFAULT_PACK_SIZE);
  assert.equal(getDefaultPackSizeForType('كبسولات'), DEFAULT_PACK_SIZE);
  assert.equal(getDefaultPackSizeForType('شراب / مل'), DEFAULT_PACK_SIZE);
  assert.equal(getDefaultPackSizeForType('حقن / أمبول'), DEFAULT_PACK_SIZE);
});

test('getPackSize resolves explicit packSize and migrates legacy strip and non-strip records', () => {
  const base: Medicine = {
    id: 'm_pack',
    name: 'دواء',
    type: 'شريط',
    initialPills: 28,
    dailyDose: 1,
    startDate: '2026-11-01',
    courseType: 'chronic',
    courseDays: null,
    warningDays: 3,
    notes: '',
  };

  // Explicit packSize takes priority over legacy stripCapacity and initialPills
  assert.equal(getPackSize({ ...base, packSize: 10, stripCapacity: 14, initialPills: 4 }), 10);

  // Legacy v1.0.10 strip record uses stripCapacity without altering active initialPills
  assert.equal(
    getPackSize({ ...base, stripCapacity: 14, stripPillsRemainingAtStart: 6 }),
    14
  );

  // Legacy non-strip record without packSize falls back to initialPills
  assert.equal(getPackSize({ ...base, type: 'أقراص', initialPills: 60 }), 60);

  // Invalid or zero values fall back to type default
  assert.equal(getPackSize({ ...base, type: 'شريط', initialPills: 0 }), DEFAULT_STRIP_CAPACITY);
  assert.equal(getPackSize({ ...base, type: 'أقراص', initialPills: 0 }), DEFAULT_PACK_SIZE);
});

test('calculateMedicationMetrics scales opened packs against packSize and clamps carry-over at 100%', () => {
  const refDate = new Date(2026, 10, 11);

  // Opened strip: 4 remaining out of 10-pill strip, started today
  const openedStrip: Medicine = {
    id: 'opened_1',
    name: 'دواء مفتوح',
    type: 'شريط',
    packSize: 10,
    initialPills: 4,
    dailyDose: 1,
    startDate: '2026-11-11',
    courseType: 'chronic',
    courseDays: null,
    warningDays: 2,
    notes: '',
  };
  const openedMetrics = calculateMedicationMetrics(openedStrip, refDate);
  assert.equal(openedMetrics.packSize, 10);
  assert.equal(openedMetrics.referenceCapacity, 10);
  assert.equal(openedMetrics.currentPills, 4);
  assert.equal(openedMetrics.daysRemaining, 4);
  assert.equal(openedMetrics.percentage, 40);
  assert.equal(isStartedOpened(openedStrip), true);

  // After 2 days, 2 pills remain out of 10 (20%)
  const twoDaysLater = calculateMedicationMetrics(openedStrip, new Date(2026, 10, 13));
  assert.equal(twoDaysLater.currentPills, 2);
  assert.equal(twoDaysLater.percentage, 20);
  assert.equal(twoDaysLater.isUrgent, true);

  // Carry-over refill: 12 starting pills on a 10-pill strip
  const carriedOver: Medicine = {
    ...openedStrip,
    initialPills: 12,
  };
  const carryMetrics = calculateMedicationMetrics(carriedOver, refDate);
  assert.equal(carryMetrics.packSize, 10);
  assert.equal(carryMetrics.referenceCapacity, 12);
  assert.equal(carryMetrics.percentage, 100);
  assert.equal(isStartedOpened(carriedOver), false);

  // Opened with more than 1 strip (e.g. 1 full strip + 4 loose pills = 14)
  const multiStripOpened: Medicine = {
    ...openedStrip,
    initialPills: 14,
  };
  const multiMetrics = calculateMedicationMetrics(multiStripOpened, refDate);
  assert.equal(multiMetrics.referenceCapacity, 14);
  assert.equal(multiMetrics.percentage, 100);

  // Depleted/zero-adjusted medicine should NOT be labeled as started-opened
  const zeroAdjusted: Medicine = {
    ...openedStrip,
    packSize: 30,
    initialPills: 0,
  };
  assert.equal(isStartedOpened(zeroAdjusted), false);
  const zeroMetrics = calculateMedicationMetrics(zeroAdjusted, refDate);
  assert.equal(zeroMetrics.currentPills, 0);
  assert.equal(zeroMetrics.isDepleted, true);
});

test('resolveMedicineFormInventory validates packSize and opened remaining values cleanly', () => {
  assert.deepEqual(resolveMedicineFormInventory(10, false), {
    packSize: 10,
    initialPills: 10,
  });
  assert.deepEqual(resolveMedicineFormInventory(10, true, 4.5), {
    packSize: 10,
    initialPills: 4.5,
  });
  // Supports quarter-tablet doses (.25 / .75)
  assert.deepEqual(resolveMedicineFormInventory(10, true, 1.25), {
    packSize: 10,
    initialPills: 1.25,
  });
  // Allows starting balance > packSize (e.g. 1 full strip + 4 loose pills)
  assert.deepEqual(resolveMedicineFormInventory(10, true, 14), {
    packSize: 10,
    initialPills: 14,
  });

  // Edit mode preserves existingInitialPills when cycle balance is not explicitly overridden
  assert.deepEqual(
    resolveMedicineFormInventory(30, false, undefined, { existingInitialPills: 10 }),
    { packSize: 30, initialPills: 10 }
  );
  assert.deepEqual(
    resolveMedicineFormInventory(30, false, undefined, { existingInitialPills: 0 }),
    { packSize: 30, initialPills: 0 }
  );
  assert.deepEqual(
    resolveMedicineFormInventory(10, false, undefined, { existingInitialPills: 19.75 }),
    { packSize: 10, initialPills: 19.75 }
  );
  // Edit mode allows explicitly setting cycle balance to 0 or .25 increments
  assert.deepEqual(
    resolveMedicineFormInventory(30, true, 0, { existingInitialPills: 5 }),
    { packSize: 30, initialPills: 0 }
  );
  assert.deepEqual(
    resolveMedicineFormInventory(10, true, 19.75, { existingInitialPills: 10 }),
    { packSize: 10, initialPills: 19.75 }
  );

  // Rejects invalid/non-positive/rounds-to-zero numbers in Add mode and negative in Edit mode
  assert.equal(resolveMedicineFormInventory(0, false), null);
  assert.equal(resolveMedicineFormInventory(0.004, false), null);
  assert.equal(resolveMedicineFormInventory(-5, false), null);
  assert.equal(resolveMedicineFormInventory(Number.NaN, false), null);
  assert.equal(resolveMedicineFormInventory(10, true, 0), null);
  assert.equal(resolveMedicineFormInventory(10, true, 0.004), null);
  assert.equal(resolveMedicineFormInventory(10, true, -2), null);
  assert.equal(resolveMedicineFormInventory(10, true, Number.NaN), null);
  assert.equal(
    resolveMedicineFormInventory(10, true, -1, { existingInitialPills: 5 }),
    null
  );
});

test('calculateRefillResult computes refill totals with carry-over, multipliers, and fallback', () => {
  const refDate = new Date(2026, 10, 15);
  const med: Medicine = {
    id: 'refill_1',
    name: 'دواء شريطي',
    type: 'شريط',
    packSize: 10,
    initialPills: 4,
    dailyDose: 1,
    startDate: '2026-11-13', // 2 days elapsed -> 2 pills remaining
    courseType: 'chronic',
    courseDays: null,
    warningDays: 3,
    notes: '',
  };

  // Standard x1 refill with carry-over
  assert.deepEqual(calculateRefillResult(med, 10, true, refDate), {
    addedAmount: 10,
    carriedOverPills: 2,
    totalStartingPills: 12,
  });

  // x2 strips refill without carry-over
  assert.deepEqual(calculateRefillResult(med, 20, false, refDate), {
    addedAmount: 20,
    carriedOverPills: 0,
    totalStartingPills: 20,
  });

  // Invalid or rounds-to-zero addedAmount falls back to saved packSize (10)
  assert.deepEqual(calculateRefillResult(med, 0, true, refDate), {
    addedAmount: 10,
    carriedOverPills: 2,
    totalStartingPills: 12,
  });
  assert.deepEqual(calculateRefillResult(med, 0.004, false, refDate), {
    addedAmount: 10,
    carriedOverPills: 0,
    totalStartingPills: 10,
  });
  assert.deepEqual(calculateRefillResult(med, Number.NaN, false, refDate), {
    addedAmount: 10,
    carriedOverPills: 0,
    totalStartingPills: 10,
  });

  // Rounding consistency: addedAmount + carriedOverPills === totalStartingPills (no 10 + 1 = 11.01 drift)
  const onePillLeftMed: Medicine = {
    ...med,
    initialPills: 3, // 2 days elapsed -> 1 pill remaining
  };
  const roundingCheck = calculateRefillResult(onePillLeftMed, 10.005, true, refDate);
  assert.equal(
    +(roundingCheck.addedAmount + roundingCheck.carriedOverPills).toFixed(2),
    roundingCheck.totalStartingPills
  );

  // Depleted medicine carries over 0 even if carryOver is true
  const depletedDate = new Date(2026, 10, 20);
  assert.deepEqual(calculateRefillResult(med, 10, true, depletedDate), {
    addedAmount: 10,
    carriedOverPills: 0,
    totalStartingPills: 10,
  });
});

test('updateMedicineInventory preserves explicit and legacy packSize across balance adjustments and refills', () => {
  // Legacy non-strip record (packSize not yet saved) adjusted to 5 pills
  const legacyPack: Medicine = {
    id: 'legacy_box',
    name: 'كونكور',
    type: 'أقراص',
    initialPills: 30,
    dailyDose: 1,
    startDate: '2026-11-01',
    courseType: 'chronic',
    courseDays: null,
    warningDays: 3,
    notes: '',
  };
  const adjustedLegacy = updateMedicineInventory(legacyPack, 5, '2026-11-20');
  assert.equal(adjustedLegacy.initialPills, 5);
  assert.equal(adjustedLegacy.packSize, 30);
  assert.equal(getPackSize(adjustedLegacy), 30);
  assert.deepEqual(adjustedLegacy.renewalAlertPlan, []);

  // Legacy v1.0.10 strip record locks in stripCapacity (14) on update
  const legacyStrip: Medicine = {
    id: 'legacy_strip',
    name: 'دواء شريطي قديم',
    type: 'شريط',
    initialPills: 28,
    stripCapacity: 14,
    stripPillsRemainingAtStart: 6,
    dailyDose: 1,
    startDate: '2026-11-01',
    courseType: 'chronic',
    courseDays: null,
    warningDays: 3,
    notes: '',
  };
  const refilledLegacyStrip = updateMedicineInventory(legacyStrip, 16, '2026-11-22');
  assert.equal(refilledLegacyStrip.initialPills, 16);
  assert.equal(refilledLegacyStrip.packSize, 14);
  assert.equal(getPackSize(refilledLegacyStrip), 14);

  // Configured opened strip keeps packSize=10 after adjust (2) and carry-over refill (12)
  const openedStrip: Medicine = {
    id: 'opened_strip',
    name: 'شريط مفتوح',
    type: 'شريط',
    packSize: 10,
    initialPills: 4,
    dailyDose: 1,
    startDate: '2026-11-20',
    courseType: 'chronic',
    courseDays: null,
    warningDays: 3,
    notes: '',
  };
  const adjustedOpened = updateMedicineInventory(openedStrip, 2, '2026-11-22');
  assert.equal(adjustedOpened.packSize, 10);
  assert.equal(adjustedOpened.initialPills, 2);

  const refilledOpened = updateMedicineInventory(adjustedOpened, 12, '2026-11-22');
  assert.equal(refilledOpened.packSize, 10);
  assert.equal(refilledOpened.initialPills, 12);
});

test('getDefaultSampleMedicines initializes explicit packSize for every sample medicine', () => {
  const samples = getDefaultSampleMedicines(Date.UTC(2026, 10, 27));
  assert.ok(samples.length > 0);
  for (const med of samples) {
    assert.equal(med.packSize, med.initialPills);
  }
});
