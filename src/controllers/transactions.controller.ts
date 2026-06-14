import type { Request, Response } from 'express';
import { ApiError } from '../errors/api-error.ts';
import { assertUuid } from '../validation/uuid.ts';
import {
  approveTransaction,
  createTransaction,
  listByUser,
  rejectTransaction,
} from '../services/transactions.service.ts';

export async function create(req: Request, res: Response): Promise<void> {
  const body = req.body ?? {};
  const source = assertUuid(body.source, 'source');
  const destination = assertUuid(body.destination, 'destination');
  const amount = Number(body.amount);
  const idempotencyKey = req.header('Idempotency-Key') ?? null;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, 'amount must be a positive number');
  }
  if (source === destination) {
    throw new ApiError(400, 'source and destination must be different');
  }

  const { transaction, replayed } = await createTransaction({
    source,
    destination,
    amount,
    idempotencyKey,
  });

  res.status(replayed ? 200 : 201).json(transaction);
}

export async function list(req: Request, res: Response): Promise<void> {
  const userId = assertUuid(req.query.userId, 'userId');
  const transactions = await listByUser(userId);
  res.json(transactions);
}

export async function approve(req: Request, res: Response): Promise<void> {
  const id = assertUuid(req.params.id, 'id');
  const transaction = await approveTransaction(id);
  res.json(transaction);
}

export async function reject(req: Request, res: Response): Promise<void> {
  const id = assertUuid(req.params.id, 'id');
  const transaction = await rejectTransaction(id);
  res.json(transaction);
}
