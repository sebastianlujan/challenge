import type { PoolClient } from 'pg';
import { pool, withTransaction } from '../db/pool.ts';
import { ApiError } from '../errors/api-error.ts';
import {
  toTransaction,
  type Status,
  type Transaction,
  type TransactionRow,
} from '../models/transaction.ts';
import { transactionsRepository } from '../repositories/transactions.repository.ts';

const AUTO_APPROVE_LIMIT = 50_000;

export interface CreateTransactionInput {
  source: string;
  destination: string;
  amount: number;
  idempotencyKey: string | null;
}

export interface CreateTransactionResult {
  transaction: Transaction;
  replayed: boolean;
}

async function moveFunds(
  client: PoolClient,
  source: string,
  destination: string,
  amount: number,
): Promise<void> {
  const balance = await transactionsRepository.lockBalance(client, source);
  if (balance < amount) {
    throw new ApiError(422, 'insufficient balance in source account');
  }
  await transactionsRepository.adjustBalance(client, source, -amount);
  await transactionsRepository.adjustBalance(client, destination, amount);
}

export async function listByUser(userId: string): Promise<Transaction[]> {
  const rows = await transactionsRepository.findByUser(pool, userId);
  return rows.map(toTransaction);
}

export async function approveTransaction(id: string): Promise<Transaction> {
  return withTransaction(async (client) => {
    const tx = await transactionsRepository.lockTransaction(client, id);
    if (!tx) throw new ApiError(404, 'transaction not found');
    if (tx.status !== 'pending') {
      throw new ApiError(409, 'transaction is not pending');
    }
    await moveFunds(client, tx.source, tx.destination, Number(tx.amount));
    const updated = await transactionsRepository.updateStatus(client, id, 'confirmed');
    return toTransaction(updated);
  });
}

export async function rejectTransaction(id: string): Promise<Transaction> {
  return withTransaction(async (client) => {
    const tx = await transactionsRepository.lockTransaction(client, id);
    if (!tx) throw new ApiError(404, 'transaction not found');
    if (tx.status !== 'pending') {
      throw new ApiError(409, 'transaction is not pending');
    }
    const updated = await transactionsRepository.updateStatus(client, id, 'rejected');
    return toTransaction(updated);
  });
}

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<CreateTransactionResult> {
  return withTransaction(async (client) => {
    if (input.idempotencyKey) {
      const previous = await transactionsRepository.findByIdempotencyKey(
        client,
        input.idempotencyKey,
      );
      if (previous) return { transaction: toTransaction(previous), replayed: true };
    }

    const ids = await transactionsRepository.existingIds(client, [
      input.source,
      input.destination,
    ]);
    if (!ids.has(input.source)) throw new ApiError(404, 'source user not found');
    if (!ids.has(input.destination)) throw new ApiError(404, 'destination user not found');

    const status: Status =
      input.amount > AUTO_APPROVE_LIMIT ? 'pending' : 'confirmed';

    const inserted = await transactionsRepository.insertTransaction(client, {
      source: input.source,
      destination: input.destination,
      amount: input.amount,
      status,
      idempotencyKey: input.idempotencyKey,
    });

    if (!inserted) {
      const previous = await transactionsRepository.findByIdempotencyKey(
        client,
        input.idempotencyKey as string,
      );
      return { transaction: toTransaction(previous as TransactionRow), replayed: true };
    }

    if (status === 'confirmed') {
      await moveFunds(client, input.source, input.destination, input.amount);
    }

    return { transaction: toTransaction(inserted), replayed: false };
  });
}
