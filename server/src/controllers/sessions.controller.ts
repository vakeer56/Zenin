import { Response, NextFunction } from 'express';
import { db } from '../db';
import { pomodoroSessions, tasks } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';

const startSessionSchema = z.object({
  taskId: z.string().uuid().optional(),
  type: z.enum(['work', 'short_break', 'long_break']),
  durationSeconds: z.number().int().min(60).max(7200),
});

const endSessionSchema = z.object({
  completed: z.boolean().default(true),
});

export const startSession = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = startSessionSchema.parse(req.body);

    const [session] = await db
      .insert(pomodoroSessions)
      .values({ ...data, userId: req.userId! })
      .returning();

    res.status(201).json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
};

export const endSession = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { completed } = endSessionSchema.parse(req.body);

    const [session] = await db
      .update(pomodoroSessions)
      .set({ endedAt: new Date(), completed })
      .where(and(eq(pomodoroSessions.id, id), eq(pomodoroSessions.userId, req.userId!)))
      .returning();

    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    // If work session completed, increment task pomodoro count
    if (completed && session.type === 'work' && session.taskId) {
      await db
        .update(tasks)
        .set({
          completedPomodoros: sql`${tasks.completedPomodoros} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, session.taskId));
    }

    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
};

export const getSessions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const userSessions = await db
      .select()
      .from(pomodoroSessions)
      .where(eq(pomodoroSessions.userId, req.userId!))
      .orderBy(desc(pomodoroSessions.startedAt))
      .limit(limit)
      .offset(offset);

    res.json({ success: true, data: userSessions });
  } catch (err) {
    next(err);
  }
};
