import express, { type Request, type Response } from 'express';
import { errorHandler } from './middlewares/error-handler.ts';
import { transactionsRouter } from './routes/transactions.routes.ts';

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.use('/transactions', transactionsRouter);

  app.use(errorHandler);

  return app;
}
