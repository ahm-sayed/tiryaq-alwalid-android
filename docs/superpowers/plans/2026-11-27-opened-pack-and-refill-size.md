# Opened Pack & Standard Refill Size Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a permanent full strip/pack capacity (`packSize`) for all medication types and an "opened currently" option at entry, wire `packSize` into automatic countdown progress and quick refills (`×1`/`×2`/`×3` + manual edit + carry-over), preserve `packSize` across refills and balance adjustments, and ship the verified update as an Android APK (`v1.0.11`) via GitHub Actions and ADB.

**Architecture:** Keep `initialPills` as the starting balance of the active cycle while introducing a permanent `packSize?: number` field on `Medicine` with clean legacy fallback (`packSize` → `stripCapacity` for `شريط` → `initialPills` → type default). Pure domain helpers in `src/utils/medicationLogic.ts` own all pack-size resolution, progress scaling, form-inventory resolution, refill calculation, and inventory updates so React components (`MedicineModals.tsx`, `MedicineCard.tsx`, `App.tsx`) remain thin and fully verified by unit tests.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vite 8, Capacitor Android (GitHub Actions workflow), Node built-in test runner (`node --test`).

**Spec:** `docs/superpowers/specs/2026-11-24-opened-pack-and-refill-size-design.md`

## Global Constraints
- Preserve `STORAGE_KEY = 'tiryaq_elderly_medicines_v4'` and smoothly read legacy records including `stripCapacity`, `stripPillsRemainingAtStart`, and `actualStripPills`.
- Arabic RTL UI matching existing Tailwind design system, accessible labels (`label`/`for`/`id`, `aria-describedby`, `aria-live`, `type="button"` on non-submit buttons, `inputMode="decimal"` on numeric inputs).
- Clean `npm.cmd run lint` (`tsc --noEmit`), passing `node --test` unit tests, and passing `npm.cmd run build` (`vite build`).
- Never wipe existing user app data on the connected phone (`bf8b4f5b`) without explicit confirmation if an APK signature mismatch occurs.

## Review Focus
1. Legacy `شريط` record (`initialPills: 28, stripCapacity: 14, stripPillsRemainingAtStart: 6`, no `packSize`) resolves `getPackSize` to `14` while keeping active countdown on `initialPills: 28` and locking `packSize: 14` on balance adjust or refill.
2. Legacy non-strip record (`initialPills: 30`, no `packSize`) locks `packSize: 30` before `updateMedicineInventory` overwrites `initialPills` during balance adjust (`actualCount: 5`), so the next refill still defaults to `30`.
3. Opened start (`packSize: 10, initialPills: 4`) computes `referenceCapacity: 10` and `percentage: 40`, while carry-over refill (`10 + 2 = 12`) computes `referenceCapacity: 12` and clamps `percentage: 100`.
4. Opened start allows remaining quantity larger than one strip (e.g., `14` pills remaining when `packSize: 10`), and rejects non-positive/NaN inputs on submit/refill.
5. Editing a medicine whose `initialPills !== packSize` (opened, adjusted, or carried-over) preserves `initialPills` when updating `packSize` or notes, without falsely resetting the active countdown or renewal alerts.

---

### Task 1: Core Pack Size, Opened-Pack Metrics, Form & Refill Logic

**Files:**
- Modify: `src/utils/medicationLogic.ts`
- Test: `src/utils/medicationLogic.test.ts`

**Interfaces:**
- Produces in `src/utils/medicationLogic.ts`:
  - `DEFAULT_PACK_SIZE = 30`
  - `DEFAULT_STRIP_CAPACITY = 10`
  - `Medicine.packSize?: number`
  - `MedicationMetrics.packSize: number`
  - `MedicationMetrics.referenceCapacity: number`
  - `getDefaultPackSizeForType(type: string): number`
  - `getPackSize(med: Pick<Medicine, 'type' | 'packSize' | 'stripCapacity' | 'initialPills'>): number`
  - `isStartedOpened(med: Medicine): boolean`
  - `resolveMedicineFormInventory(packSize: number, isOpened: boolean, openedRemaining?: number): { packSize: number; initialPills: number } | null`
  - `calculateRefillResult(med: Medicine, addedAmount: number, carryOver: boolean, referenceDate?: Date): { addedAmount: number; carriedOverPills: number; totalStartingPills: number }`
  - `updateMedicineInventory(med: Medicine, initialPills: number, startDate: string): Medicine`

- [ ] **Step 1: Write failing tests in `src/utils/medicationLogic.test.ts`**
  Add unit tests covering all five Review Focus scenarios:
  - `getDefaultPackSizeForType` returns `10` for `'شريط'` and `30` for `'أقراص'`, `'كبسولات'`, `'شراب / مل'`.
  - `getPackSize` prioritizes explicit `packSize`, then `stripCapacity` for legacy `'شريط'`, then `initialPills` for legacy non-strip, then type default.
  - `calculateMedicationMetrics` exposes `packSize` and `referenceCapacity`: opened (`packSize: 10, initialPills: 4`) gives `referenceCapacity: 10, percentage: 40`; carry-over (`packSize: 10, initialPills: 12`) gives `referenceCapacity: 12, percentage: 100`; opened larger than 1 strip (`packSize: 10, initialPills: 14`) gives `referenceCapacity: 14, percentage: 100`.
  - `resolveMedicineFormInventory` handles unopened (`{ packSize: 10, initialPills: 10 }`), opened smaller (`{ packSize: 10, initialPills: 4.5 }`), opened larger (`{ packSize: 10, initialPills: 14 }`), and returns `null` for `0`, negative, or `NaN` values.
  - `calculateRefillResult` computes `addedAmount`, `carriedOverPills`, and `totalStartingPills` for `×1`/`×2` refills, carry-over on/off, depleted medicine, and falls back to `getPackSize(med)` when `addedAmount <= 0` or `NaN`.
  - `updateMedicineInventory` preserves `packSize` for configured meds AND locks in legacy `packSize` (both `stripCapacity` for `'شريط'` and old `initialPills` for `'أقراص'`) before replacing `initialPills`, while clearing `renewalAlertPlan`.
  - `getDefaultSampleMedicines` sets explicit `packSize` on sample entries.

- [ ] **Step 2: Run tests to verify RED**
  Run: `node --test src/utils/medicationLogic.test.ts`
  Expected: FAIL because new exports (`getPackSize`, `getDefaultPackSizeForType`, `resolveMedicineFormInventory`, `calculateRefillResult`, `isStartedOpened`) do not exist yet.

- [ ] **Step 3: Implement the pure helpers and metrics updates in `src/utils/medicationLogic.ts`**
  - Add `DEFAULT_PACK_SIZE = 30`, `packSize?: number` on `Medicine`, `packSize` and `referenceCapacity` on `MedicationMetrics`.
  - Implement `getDefaultPackSizeForType`, `getPackSize`, `isStartedOpened`, `resolveMedicineFormInventory`, `calculateRefillResult`.
  - Update `updateMedicineInventory` to lock in `packSize: getPackSize(med)` and clear `renewalAlertPlan: []`.
  - Update `calculateMedicationMetrics` to compute `packSize = getPackSize(med)`, `referenceCapacity = Math.max(initialPills, packSize)`, and `percentage` against `referenceCapacity`.
  - Include `packSize` on `getDefaultSampleMedicines()`.
  - Remove unused `getStripDescription` / `getActualStripPills` / `getStripPillsRemainingAtStart` only after confirming Task 2 replaces their usages, OR keep legacy aliases clean and remove dead code once Task 2 wires UI. (Keep `getStripCapacity` deprecated or clean up in Task 2 so Task 1 stays green on its own.)

- [ ] **Step 4: Run tests to verify GREEN**
  Run: `node --test src/utils/medicationLogic.test.ts`
  Expected: All tests PASS with 0 failures.

- [ ] **Step 5: Commit Task 1**
  Commit `src/utils/medicationLogic.ts` and `src/utils/medicationLogic.test.ts`.

---

### Task 2: UI Integration (`MedicineModals.tsx`, `MedicineCard.tsx`, `App.tsx`)

**Files:**
- Modify: `src/components/MedicineModals.tsx`
- Modify: `src/components/MedicineCard.tsx`
- Modify: `src/App.tsx`
- Modify: `src/utils/medicationLogic.ts` (remove any dead v1.0.10 strip-only display helper once unreferenced)

**Interfaces:**
- Consumes from Task 1: `DEFAULT_PACK_SIZE`, `getDefaultPackSizeForType`, `getPackSize`, `isStartedOpened`, `resolveMedicineFormInventory`, `calculateRefillResult`, `updateMedicineInventory`, `calculateMedicationMetrics` (`metrics.packSize`, `metrics.referenceCapacity`).

- [ ] **Step 1: Update `MedicineFormModal` in `src/components/MedicineModals.tsx`**
  - Replace `initialPills` + `شريط`-only purple box with:
    1. **الكمية الكاملة في الشريط / العبوة (كمية التجديد)** (`packSize`, required, `min="0.5"`, `step="0.5"`, `inputMode="decimal"`, `aria-describedby`). On a *new* medicine, switching `type` auto-updates `packSize` to `getDefaultPackSizeForType(nextType)` only if the user hasn't manually edited `packSize` yet.
    2. Accessible toggle checkbox **"الدواء مفتوح حالياً؟"** (`id="medIsOpened"`, `aria-expanded`, `aria-controls="openedRemainingGroup"`).
       - In Add mode: starts unchecked; checking reveals **"الكمية المتبقية حالياً"** (`openedRemaining`, `min="0.5"`, `step="0.5"`, `inputMode="decimal"`, no restrictive `max={packSize}` so multi-strip partial stock like 14 out of 10 works).
       - In Edit mode: starts checked when `editingMedicine.initialPills !== getPackSize(editingMedicine)` with label clarifying **"رصيد بداية الدورة الحالية (مختلف عن السعة الكاملة)"** pre-filled with `editingMedicine.initialPills`, so editing `packSize` or notes never resets the ongoing countdown.
    3. On submit: validate via `resolveMedicineFormInventory`; show clear inline Arabic validation feedback (`role="alert"`) and focus the invalid field if invalid, otherwise pass `{ ...medData, packSize, initialPills }` to `onSave`.

- [ ] **Step 2: Update `QuickRefillModal` in `src/components/MedicineModals.tsx`**
  - Default `addedAmount` to `getPackSize(medicine)` (NOT `medicine.initialPills`!).
  - Remove the disconnected `شريط`-only `stripPillsRemainingAtStart` block.
  - Add quick multiplier buttons (`×1`, `×2`, `×3` showing e.g. `×1 (10)`, `×2 (20)`, `×3 (30)`) with `type="button"` and `aria-pressed`, plus editable numeric input (`min="0.5"`, `step="0.5"`, `inputMode="decimal"`).
  - Keep carry-over checkbox when `metrics.currentPills > 0`.
  - Render live balance preview (`aria-live="polite"`) powered by `calculateRefillResult(medicine, parsedAmount, carryOver)`.
  - Update `QuickRefillModalProps.onConfirm` signature to `(medId: string, addedAmount: number, carryOver: boolean) => void`.

- [ ] **Step 3: Update `MedicineCard.tsx` and `App.tsx`**
  - In `MedicineCard.tsx`:
    - Display `metrics.currentPills / metrics.referenceCapacity` in the balance readout so an opened strip (4 of 10) clearly reads `4 / 10`.
    - Show a clean pill/tag or info line for standard refill size (`سعة التجديد: {metrics.packSize}`) and, when `isStartedOpened(med)` is true, show `بدأ مفتوحاً ({med.initialPills} من {metrics.packSize})`.
    - Update button text/title cleanly ("تجديد الدواء" / "تصحيح الرصيد").
  - In `App.tsx`:
    - Include `med.packSize !== source.packSize` in `syncMedicationAlarms` change comparison and remove obsolete `stripCapacity`/`stripPillsRemainingAtStart` checks.
    - Simplify `handleConfirmRefill` to use `calculateRefillResult` and `updateMedicineInventory(m, result.totalStartingPills, formatIsoDate())`.
    - Keep `handleConfirmAdjust` calling `updateMedicineInventory(m, actualCount, formatIsoDate())` (which now locks in and preserves `packSize`).
    - Ensure `handleSaveMedicine` preserves `renewalAlertPlan` unless `initialPills` or `startDate` changed, while persisting updated `packSize`.

- [ ] **Step 4: Remove unused v1.0.10 strip-only helpers & verify full suite + TypeScript + Vite build**
  Run: `node --test src/utils/medicationLogic.test.ts; npm.cmd run lint; npm.cmd run build`
  Expected: All unit tests PASS, `tsc --noEmit` exits 0, `vite build` exits 0.

- [ ] **Step 5: Commit Task 2**
  Commit all updated source and test files cleanly.

---

### Task 3: Final Code Review, GitHub Push (`v1.0.11`), and Phone APK Install

- [ ] **Step 1: Dispatch fresh code-reviewer subagent on full branch diff**
  Review against spec, Review Focus, and codebase quality. Fix any Critical/Important findings via TDD in one pass and re-run full verification (`node --test`, `npm.cmd run lint`, `npm.cmd run build`).
- [ ] **Step 2: Push `main` to `origin` (`ahm-sayed/tiryaq-alwalid-android`)**
  Watch GitHub Actions workflow (`Build Android APK & Create GitHub Release`) complete and verify `v1.0.11` release with `tiryaq-alwalid-android.apk`.
- [ ] **Step 3: Download `v1.0.11` APK and install on connected phone (`bf8b4f5b`)**
  Run `adb -s bf8b4f5b install -r tiryaq-alwalid-android.apk`. If Android reports `INSTALL_FAILED_UPDATE_INCOMPATIBLE` (ephemeral debug keystore mismatch), STOP and report to the user with the download link + ask before uninstalling (to protect their existing medication data). Otherwise launch the app and confirm installation succeeded!
