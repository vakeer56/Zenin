import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error(err);

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  const status = (err as any).status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal server error',
  });
};

export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({ success: false, error: `Route ${req.url} not found` });
};
