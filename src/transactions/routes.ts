import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.ts';
import * as transactionsController from './controller.ts';

export const transactionsRouter = Router();

transactionsRouter.post('/', asyncHandler(transactionsController.create));
