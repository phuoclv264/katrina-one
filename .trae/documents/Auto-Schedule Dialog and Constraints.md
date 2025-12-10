## Objectives
- In-app auto scheduling using server-provided Availability. No AI.
- Specific Staff limits override Global when both set.
- Preview proposed assignments before applying; Apply uses what is shown in the preview.

## Key Change: Preview-First Apply
- The Auto-Schedule Dialog runs the engine and renders a preview of proposed assignments.
- Users review and optionally tweak selections in the preview.
- `Apply Assignments` applies exactly the previewed selections (no re-run on apply).

## Files
- Add: `src/lib/scheduler/index.ts`, `src/lib/scheduler/constraints.ts`, `src/lib/scheduler/allocator.ts`.
- Update: `src/lib/types.ts`, `src/lib/schedule-store.ts`, `src/app/(app)/shift-scheduling/_components/auto-schedule-dialog.tsx`, `src/app/(app)/shift-scheduling/_components/schedule-view.tsx`.

## Data Types
- Add `ScheduleCondition` union (WorkloadLimit, ShiftStaffing, StaffPriority, StaffShiftLink, DailyShiftLimit) and `Assignment`, `ScheduleRunResult`.
- Precedence: Specific overrides Global.

## Store
- Structured constraints API: `subscribeToStructuredConstraints`, `updateStructuredConstraints` on `app-data/scheduleConstraints` doc.
- Consume Availability from server using existing subscriptions.

## Scheduler Engine
- Normalize constraints; seed forced; exclude banned; compute per-user caps with precedence.
- Score candidates and allocate respecting role demand and caps; produce `ScheduleRunResult`.
- Deterministic tie-breakers.

## Auto-Schedule Dialog
- Tabs: Workload, Staffing, Priority, Links, Availability, Preview.
- Preview Tab:
  - Shows a table grouped by day and shift with proposed `assignments` and `unfilled`.
  - Per-shift controls: toggle proposed users on/off; add/remove candidate from the proposed list if needed.
  - Summary metrics: filled/total, warnings.
  - `Run Auto Schedule` populates preview; `Apply Assignments` is disabled until preview exists.
  - `Apply Assignments` merges the currently displayed, user-adjusted preview selections into `localSchedule`.
  - Merge strategy: preserve existing assigned users unless explicitly replaced; configurable `Replace All` or `Merge` radio.
- Workload tab note: "Specific Staff limits override Global" with effective limits preview per user.

## Schedule View Integration
- Replace legacy text and AI button with `Xếp lịch tự động` opening the dialog.
- Pass `localSchedule`, `availability`, `allUsers`, `shiftTemplates`, and structured `constraints`.
- On Apply: update `localSchedule` with previewed selections; set `hasUnsavedChanges`; save via existing `updateSchedule`.

## Validation and Tests
- UI validation for limits; warning for conflicts.
- Unit/scenario tests for precedence, allocator, and preview apply behavior.

## Accessibility and i18n
- Keep `Xếp lịch tự động` label.
- Keyboard and aria support; strings extracted for translation.