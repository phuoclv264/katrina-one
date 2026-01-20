export type ShiftKey = 'sang' | 'trua' | 'toi';

export type ShiftTimeFrames = Record<ShiftKey, { start: number; end: number }>;

export const DEFAULT_MAIN_SHIFT_TIMEFRAMES: ShiftTimeFrames = {
  sang: { start: 6, end: 12 },
  trua: { start: 12, end: 17 },
  toi: { start: 17, end: 23.5 },
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

  return Array.from(keys);
}
