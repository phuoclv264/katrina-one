## Types
1. Add `ScheduleCondition` discriminated union in `src/lib/types.ts`:
   - StaffPriority: `{ type: 'StaffPriority', userId, userName, shiftId?, shiftLabel?, date? }`
   - ShiftStaffing: `{ type: 'ShiftStaffing', date, shiftLabel, role, requiredCount }`
   - DailyShiftLimit: `{ type: 'DailyShiftLimit', maxPerDay }`
   - StaffShiftLink: `{ type: 'StaffShiftLink', mode: 'require' | 'ban', userId, userName, date, shiftLabel }`
   - WorkloadLimit: `{ type: 'WorkloadLimit', target: 'all' | { userId, userName }, minShiftsPerWeek?, maxShiftsPerWeek?, minHoursPerWeek?, maxHoursPerWeek? }`
2. Add `ScheduleConstraintsDoc` to hold both text and structured data:
   - `{ constraintsText?: string; conditions?: ScheduleCondition[]; updatedAt?: Timestamp; version?: number }`

## Data Store
1. Extend `src/lib/schedule-store.ts` (Firestore doc `app-data/scheduleConstraints`):
   - Keep existing text APIs for backward compatibility:
     - `subscribeToScheduleConstraints(callback: (text: string) => void)` and `updateScheduleConstraints(text: string)` remain.
   - Add structured APIs:
     - `subscribeToScheduleConstraintsDoc(callback: (doc: ScheduleConstraintsDoc) => void)`
     - `updateScheduleConditions(conditions: ScheduleCondition[])` (merges `{ conditions, updatedAt }`).
     - Optional helpers: `getScheduleConstraintsDoc()`, `updateScheduleConstraintsDoc(partial)`.
2. Migration behavior:
   - If doc has only `constraintsText`, initialize `conditions: []` on first structured save; do not break existing consumers.

## Dialog UI
1. Create `src/app/(app)/shift-scheduling/_components/auto-schedule-dialog.tsx`:
   - Uses shadcn Dialog components (`@/components/ui/dialog`) with controlled `open` prop.
   - Sections:
     - Workload: Set Min/Max Shifts and Min/Max Hours for “All Staff” or “Specific Staff”.
     - Staffing: "Shift [Name] on [Date] needs [Count] [Role]" rows.
     - Priority: "Prioritize [User] for [Shift]" entries.
     - Limits: "Max [N] shifts per day per user" (DailyShiftLimit).
     - Strategy note: Show explanation that allocation is proportional to availability.
   - Actions:
     - Save Conditions → persists via `updateScheduleConditions`.
     - Preview Prompt → shows serialized text from current conditions.
     - Generate Schedule → calls AI with serialized text and opens existing preview dialog.
   - Props: `users`, `shiftTemplates`, `daysOfWeek`, `weekId`, `availability`, `existingSchedule`.

## Integration
1. In `src/app/(app)/shift-scheduling/_components/schedule-view.tsx`:
   - Replace constraints Textarea and "Lưu điều kiện" with a single "Xếp lịch tự động" button opening the new dialog.
     - Current constraints UI reference: `schedule-view.tsx:782–788` for Textarea, `schedule-view.tsx:859–871` for save.
   - Subscribe to structured constraints:
     - Add effect using `subscribeToScheduleConstraintsDoc` to prefill dialog state; keep existing text subscription for compatibility (`schedule-view.tsx:192–195`).
   - Move AI generation flow into dialog:
     - Reuse existing input assembly (users, availability, templates, base schedule) currently at `schedule-view.tsx:800–833`.
     - On "Generate", pass serialized `constraintsText` into `callGenerateShiftSchedule`.
   - Keep `AiSchedulePreviewDialog` unchanged for acceptance.

## Prompt Serialization
1. Build prompt text before calling AI:
   - Header:
     - "Strategy: Allocate shifts proportionally to availability (more availability = more shifts)."
     - "Soft Constraint: Respect Min/Max Shifts and Hours."
   - For each condition:
     - WorkloadLimit (all): "Limit all staff to between [minShifts]-[maxShifts] shifts/week and [minHours]-[maxHours] hours/week."
     - WorkloadLimit (user): "Limit [userName] to between [minShifts]-[maxShifts] shifts/week and [minHours]-[maxHours] hours/week."
     - ShiftStaffing: "On [date], shift [shiftLabel] needs [requiredCount] [role]."
     - StaffPriority: "Prefer assigning [userName] to [shiftLabel] on [date]."
     - StaffShiftLink require: "Must assign [userName] to [shiftLabel] on [date]."
     - StaffShiftLink ban: "Do not assign [userName] to [shiftLabel] on [date]."
     - DailyShiftLimit: "Max [N] shifts per day per user."
2. Ensure stable ordering (Strategy → Soft Constraints → specific conditions).

## Verification
1. Save/Load:
   - Create and save conditions; reload page and confirm dialog prefilled.
2. AI Prompt:
   - Trigger Generate → inspect prompt text for strategy and limits.
3. Result Acceptance:
   - Accept AI schedule in preview; ensure local schedule updates and can be saved/published.
4. Backward compatibility:
   - Existing free-form constraints remain readable via subscription; no crashes if `conditions` is absent.

## Notes
- Library usage: follow shadcn/radix dialog patterns already used across the app.
- Types and Firestore keys are additive; no breaking changes to `GenerateShiftScheduleInput` which still expects `constraintsText`.
- i18n: Keep Vietnamese labels consistent with current UI (e.g., "Xếp lịch tự động").