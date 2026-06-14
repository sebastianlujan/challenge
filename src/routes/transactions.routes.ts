import { Router } from 'express';
import { asyncHandler } from '../middlewares/async-handler.ts';
import * as transactionsController from '../controllers/transactions.controller.ts';

export const transactionsRouter = Router();

transactionsRouter.post('/', asyncHandler(transactionsController.create));
transactionsRouter.get('/', asyncHandler(transactionsController.list));
transactionsRouter.patch('/:id/approve', asyncHandler(transactionsController.approve));
transactionsRouter.patch('/:id/reject', asyncHandler(transactionsController.reject));
