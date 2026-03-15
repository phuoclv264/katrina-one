export type ShiftKey = 'sang' | 'trua' | 'toi';

export type ShiftTimeFrames = Record<ShiftKey, { start: number; end: number }>;

export const DEFAULT_MAIN_SHIFT_TIMEFRAMES: ShiftTimeFrames = {
  sang: { start: 6, end: 12 },
  trua: { start: 12, end: 17 },
  toi: { start: 17, end: 23 },
};

/**
 * Return the active shift keys for the provided time frames.
 *
 * A shift is considered "active" when the provided `now` hour falls within
 * the window [start - beforeHours, end + afterHours).
 *
 * - timeFrames: map of shift key -> { start, end } (hours, 0-23)
 * - now: optional Date (defaults to `new Date()`)
 * - beforeHours / afterHours: inclusive/exclusive padding in hours around shift
 */
export function getActiveShiftKeys(
  timeFrames: ShiftTimeFrames,
  now: Date = new Date(),
  beforeHours = 1,
  afterHours = 1,
): ShiftKey[] {
  const currentHour = now.getHours();
  const keys = new Set<ShiftKey>();

  for (const k of Object.keys(timeFrames) as ShiftKey[]) {
    const frame = timeFrames[k];
    const validStartTime = frame.start - beforeHours;
    const validEndTime = frame.end + afterHours;

    if (currentHour >= validStartTime && currentHour < validEndTime) {
      keys.add(k);
    }
  }

  // always return in canonical order: sang, trua, toi
  const ORDERED_SHIFTS: ShiftKey[] = ['sang', 'trua', 'toi'];
  return ORDERED_SHIFTS.filter((k) => keys.has(k));
}

export function getExactShiftKey(
  timeFrames: ShiftTimeFrames,
  now: Date = new Date(),
): ShiftKey {
  const currentHour = now.getHours();
  const keys = new Set<ShiftKey>();

  for (const k of Object.keys(timeFrames) as ShiftKey[]) {
    const frame = timeFrames[k];
    const validStartTime = frame.start;
    const validEndTime = frame.end === 23 ? 24 : frame.end;

    if (currentHour >= validStartTime && currentHour < validEndTime) {
      keys.add(k);
    }
  }

  // always return in canonical order: sang, trua, toi
  const ORDERED_SHIFTS: ShiftKey[] = ['sang', 'trua', 'toi'];
  return ORDERED_SHIFTS.filter((k) => keys.has(k))[0];
}

/**
 * Calculates the adjusted minimum completions for a task based on the current shift's duration
 * relative to the main shift's duration.
 *
 * Example: A task with minCompletions = 4 in shift Sáng (6h-12h, 6 hours).
 * If the current shift is Sáng 7h (7h-12h, 5 hours), the adjusted minCompletions
 * would be: floor(5 / 6 * 4) = 3.
 *
 * @param baseMinCompletions The default minimum completions for the main shift
 * @param mainShiftKey The key of the main shift ("sang", "trua", "toi")
 * @param activeTimeSlot Optional time slot of the currently active shift { start: "HH:mm", end: "HH:mm" }
 * @param timeFrames Optional custom time frames, defaults to DEFAULT_MAIN_SHIFT_TIMEFRAMES
 * @returns The adjusted minimum completions, at least 1
 */
export function calculateAdjustedMinCompletions(
  baseMinCompletions: number,
  mainShiftKey: string,
  activeTimeSlot?: { start: string; end: string },
  timeFrames: ShiftTimeFrames = DEFAULT_MAIN_SHIFT_TIMEFRAMES
): number {
  if (!activeTimeSlot || !baseMinCompletions || baseMinCompletions <= 1) {
    return baseMinCompletions || 1;
  }

  const mainFrame = timeFrames[mainShiftKey as ShiftKey];
  if (!mainFrame) return baseMinCompletions;

  const mainDuration = mainFrame.end - mainFrame.start;
  if (mainDuration <= 0) return baseMinCompletions;

  // Helper to parse "HH:mm" to decimal hours
  const parseTimeToHours = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return (h || 0) + (m || 0) / 60;
  };

  const actualStart = parseTimeToHours(activeTimeSlot.start);
  const actualEnd = parseTimeToHours(activeTimeSlot.end);
  const actualDuration = actualEnd - actualStart;

  if (actualDuration <= 0 || actualDuration >= mainDuration) {
    return baseMinCompletions;
  }

  // Adjusted = floor(actualDuration / mainDuration * baseMinCompletions)
  const adjusted = Math.floor((actualDuration / mainDuration) * baseMinCompletions);

  return Math.max(1, adjusted);
}
