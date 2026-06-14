import type { ErrorRequestHandler } from 'express';
import { ApiError } from '../errors/api-error.ts';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'internal error' });
};
