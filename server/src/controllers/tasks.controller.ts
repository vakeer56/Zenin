import { Response, NextFunction } from 'express';
import { db } from '../db';
import { tasks } from '../db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  estimatedPomodoros: z.number().int().min(1).max(50).default(1),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional().nullable(),
  estimatedPomodoros: z.number().int().min(1).max(50).optional(),
  completedPomodoros: z.number().int().min(0).optional(),
  isCompleted: z.boolean().optional(),
  order: z.number().int().optional(),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()),
});

export const getTasks = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, req.userId!))
      .orderBy(asc(tasks.order), asc(tasks.createdAt));

    res.json({ success: true, data: userTasks });
  } catch (err) {
    next(err);
  }
};

export const createTask = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = createTaskSchema.parse(req.body);

    // Get current max order
    const existing = await db
      .select({ order: tasks.order })
      .from(tasks)
      .where(eq(tasks.userId, req.userId!))
      .orderBy(asc(tasks.order));

    const maxOrder = existing.length > 0 ? Math.max(...existing.map((t) => t.order)) + 1 : 0;

    const [task] = await db
      .insert(tasks)
      .values({ ...data, userId: req.userId!, order: maxOrder })
      .returning();

    res.status(201).json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
};

export const updateTask = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const updates = updateTaskSchema.parse(req.body);

    const [task] = await db
      .update(tasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.userId, req.userId!)))
      .returning();

    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    res.json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
};

export const deleteTask = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;

    const [deleted] = await db
      .delete(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, req.userId!)))
      .returning({ id: tasks.id });

    if (!deleted) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    res.json({ success: true, data: null, message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
};

export const completeTask = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;

    const [task] = await db
      .update(tasks)
      .set({ isCompleted: true, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.userId, req.userId!)))
      .returning();

    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    res.json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
};

export const reorderTasks = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderedIds } = reorderSchema.parse(req.body);

    await Promise.all(
      orderedIds.map((id, index) =>
        db
          .update(tasks)
          .set({ order: index })
          .where(and(eq(tasks.id, id), eq(tasks.userId, req.userId!)))
      )
    );

    res.json({ success: true, data: null, message: 'Tasks reordered' });
  } catch (err) {
    next(err);
  }
};
