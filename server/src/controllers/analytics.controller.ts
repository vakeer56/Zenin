import { Response, NextFunction } from 'express';
import { db } from '../db';
import { pomodoroSessions } from '../db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { AuthRequest } from '../middleware/auth.middleware';
import { differenceInCalendarDays } from 'date-fns';

/**
 * Convert a UTC Date to a local-date string in the user's timezone.
 * utcOffsetMinutes is the value of `new Date().getTimezoneOffset()` sent by
 * the client (negative east of UTC, e.g. IST = -330).
 *
 * Using raw arithmetic instead of Intl.DateTimeFormat for Node.js compat.
 */
function toLocalDateString(utcDate: Date, utcOffsetMinutes: number): string {
  // getTimezoneOffset() returns minutes BEHIND UTC (negative = ahead of UTC)
  // We invert so a positive value means "add to UTC to get local"
  const localMs = utcDate.getTime() - utcOffsetMinutes * 60_000;
  const local = new Date(localMs);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Start-of-day in user's local time expressed as a UTC Date object. */
function localStartOfDay(utcOffsetMinutes: number): Date {
  const now = new Date();
  const localMs = now.getTime() - utcOffsetMinutes * 60_000;
  const local = new Date(localMs);
  // Zero out time components in local space
  local.setUTCHours(0, 0, 0, 0);
  // Convert back to UTC
  return new Date(local.getTime() + utcOffsetMinutes * 60_000);
}

export const getSummary = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!;
    // Client sends its timezone offset: new Date().getTimezoneOffset()
    const tz = parseInt(req.query.utcOffset as string);
    const utcOffset = isNaN(tz) ? 0 : tz;

    const todayStart = localStartOfDay(utcOffset);

    const allSessions = await db
      .select({
        durationSeconds: pomodoroSessions.durationSeconds,
        startedAt: pomodoroSessions.startedAt,
      })
      .from(pomodoroSessions)
      .where(
        and(
          eq(pomodoroSessions.userId, userId),
          eq(pomodoroSessions.type, 'work'),
          eq(pomodoroSessions.completed, true)
        )
      )
      .orderBy(desc(pomodoroSessions.startedAt));

    const totalPomodoros = allSessions.length;
    const totalFocusMinutes = Math.round(
      allSessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60
    );

    const todaySessions = allSessions.filter(
      (s) => new Date(s.startedAt) >= todayStart
    );
    const todayPomodoros = todaySessions.length;
    const todayFocusMinutes = Math.round(
      todaySessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60
    );

    // ── Streak — keyed by LOCAL date string in user's TZ ──────────────────
    const sessionDays = new Set(
      allSessions.map((s) => toLocalDateString(new Date(s.startedAt), utcOffset))
    );

    // Current streak: walk backwards from today in user-local time
    let currentStreak = 0;
    const todayStr = toLocalDateString(new Date(), utcOffset);
    const startOffset = sessionDays.has(todayStr) ? 0 : 1;
    for (let i = startOffset; i < 365; i++) {
      const d = new Date(Date.now() - (utcOffset * 60_000) - i * 86_400_000);
      const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      if (sessionDays.has(dateStr)) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Longest streak: parse sorted day strings back into Date for differenceInCalendarDays
    const sortedDays = Array.from(sessionDays)
      .sort()
      .map((d) => new Date(d + 'T12:00:00Z')); // noon UTC avoids DST edge

    let longestStreak = 0;
    let tempStreak = sortedDays.length > 0 ? 1 : 0;
    for (let i = 1; i < sortedDays.length; i++) {
      const diff = differenceInCalendarDays(sortedDays[i], sortedDays[i - 1]);
      if (diff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    res.json({
      success: true,
      data: { totalPomodoros, totalFocusMinutes, todayPomodoros, todayFocusMinutes, currentStreak, longestStreak },
    });
  } catch (err) {
    next(err);
  }
};

export const getDaily = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 7, 90);
    const tz = parseInt(req.query.utcOffset as string);
    const utcOffset = isNaN(tz) ? 0 : tz;

    // Start of day `days-1` days ago in user's local TZ
    const since = new Date(
      localStartOfDay(utcOffset).getTime() - (days - 1) * 86_400_000
    );

    const sessions = await db
      .select({
        startedAt: pomodoroSessions.startedAt,
        durationSeconds: pomodoroSessions.durationSeconds,
      })
      .from(pomodoroSessions)
      .where(
        and(
          eq(pomodoroSessions.userId, req.userId!),
          eq(pomodoroSessions.type, 'work'),
          eq(pomodoroSessions.completed, true),
          gte(pomodoroSessions.startedAt, since)
        )
      );

    // Pre-fill every local day in the range
    const dailyMap = new Map<string, { pomodoros: number; focusMinutes: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(localStartOfDay(utcOffset).getTime() - (days - 1 - i) * 86_400_000);
      const dateStr = toLocalDateString(d, utcOffset);
      dailyMap.set(dateStr, { pomodoros: 0, focusMinutes: 0 });
    }

    sessions.forEach((s) => {
      const dateStr = toLocalDateString(new Date(s.startedAt), utcOffset);
      const existing = dailyMap.get(dateStr);
      if (existing) {
        existing.pomodoros++;
        existing.focusMinutes += Math.round(s.durationSeconds / 60);
      }
    });

    const data = Array.from(dailyMap.entries()).map(([date, stats]) => ({ date, ...stats }));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
