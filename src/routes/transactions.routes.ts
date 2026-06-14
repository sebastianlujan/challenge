import { Router } from 'express';
import { asyncHandler } from '../middlewares/async-handler.ts';
import * as transactionsController from '../controllers/transactions.controller.ts';

export const transactionsRouter = Router();

transactionsRouter.post('/', asyncHandler(transactionsController.create));
