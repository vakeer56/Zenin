import { Response, NextFunction } from 'express';
import { db } from '../db';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';
import { AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';

const updateSettingsSchema = z.object({
  workDuration: z.number().int().min(1).max(120).optional(),
  shortBreak: z.number().int().min(1).max(60).optional(),
  longBreak: z.number().int().min(1).max(120).optional(),
  sessionsBeforeLong: z.number().int().min(1).max(10).optional(),
  autoStartBreaks: z.boolean().optional(),
  autoStartPomodoros: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  theme: z.enum(['dark', 'light']).optional(),
});

export const getSettings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const [userSettings] = await db
      .select()
      .from(settings)
      .where(eq(settings.userId, req.userId!))
      .limit(1);

    if (!userSettings) {
      res.status(404).json({ success: false, error: 'Settings not found' });
      return;
    }

    res.json({ success: true, data: userSettings });
  } catch (err) {
    next(err);
  }
};

export const updateSettings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const updates = updateSettingsSchema.parse(req.body);

    const [updated] = await db
      .update(settings)
      .set(updates)
      .where(eq(settings.userId, req.userId!))
      .returning();

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};
