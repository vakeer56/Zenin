import { Response, NextFunction } from 'express';
import { db } from '../db';
import { pomodoroSessions, tasks, settings } from '../db/schema';
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

const manualSessionSchema = z.object({
  taskId: z.string().uuid().optional(),
  durationMinutes: z.number().int().min(1).max(1440),
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

export const addManualSession = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { taskId, durationMinutes } = manualSessionSchema.parse(req.body);
    
    const durationSeconds = durationMinutes * 60;
    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - durationSeconds * 1000);

    const [session] = await db
      .insert(pomodoroSessions)
      .values({
        userId: req.userId!,
        taskId,
        type: 'work',
        durationSeconds,
        startedAt,
        endedAt,
        completed: true,
      })
      .returning();

    if (taskId) {
      // Calculate how many pomodoros this is worth
      const [userSettings] = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, req.userId!));
      
      const workDuration = userSettings?.workDuration || 25;
      const pomodorosToAdd = Math.max(1, Math.round(durationMinutes / workDuration));

      await db
        .update(tasks)
        .set({
          completedPomodoros: sql`${tasks.completedPomodoros} + ${pomodorosToAdd}`,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId));
    }

    res.status(201).json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
};

export const deleteSession = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    
    const [session] = await db
      .select()
      .from(pomodoroSessions)
      .where(and(eq(pomodoroSessions.id, id), eq(pomodoroSessions.userId, req.userId!)));
      
    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }
    
    await db.delete(pomodoroSessions).where(eq(pomodoroSessions.id, id));
    
    if (session.taskId && session.completed && session.type === 'work') {
      const [userSettings] = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, req.userId!));
      const workDuration = userSettings?.workDuration || 25;
      const pomodorosToDeduct = Math.max(1, Math.round(session.durationSeconds / 60 / workDuration));
      
      await db
        .update(tasks)
        .set({
          completedPomodoros: sql`MAX(0, ${tasks.completedPomodoros} - ${pomodorosToDeduct})`,
          updatedAt: new Date()
        })
        .where(eq(tasks.id, session.taskId));
    }
    
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
