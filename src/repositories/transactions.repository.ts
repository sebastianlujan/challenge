import type { Queryable } from '../db/pool.ts';
import type { Status, TransactionRow } from '../models/transaction.ts';

export interface InsertTransactionInput {
  source: string;
  destination: string;
  amount: number;
  status: Status;
  idempotencyKey: string | null;
}

export const transactionsRepository = {
  async existingIds(db: Queryable, ids: string[]): Promise<Set<string>> {
    const { rows } = await db.query<{ id: string }>(
      'SELECT id FROM users WHERE id = ANY($1::uuid[])',
      [ids],
    );
    return new Set(rows.map((r) => r.id));
  },

  async findByIdempotencyKey(
    db: Queryable,
    key: string,
  ): Promise<TransactionRow | null> {
    const { rows } = await db.query<TransactionRow>(
      'SELECT * FROM transactions WHERE idempotency_key = $1',
      [key],
    );
    return rows[0] ?? null;
  },

  async insertTransaction(
    db: Queryable,
    input: InsertTransactionInput,
  ): Promise<TransactionRow | null> {
    const { rows } = await db.query<TransactionRow>(
      `INSERT INTO transactions (source, destination, amount, status, idempotency_key)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING *`,
      [input.source, input.destination, input.amount, input.status, input.idempotencyKey],
    );
    return rows[0] ?? null;
  },

  async findByUser(db: Queryable, userId: string): Promise<TransactionRow[]> {
    const { rows } = await db.query<TransactionRow>(
      `SELECT * FROM transactions
       WHERE source = $1 OR destination = $1
       ORDER BY created_at`,
      [userId],
    );
    return rows;
  },

  async lockTransaction(db: Queryable, id: string): Promise<TransactionRow | null> {
    const { rows } = await db.query<TransactionRow>(
      'SELECT * FROM transactions WHERE id = $1 FOR UPDATE',
      [id],
    );
    return rows[0] ?? null;
  },

  async updateStatus(
    db: Queryable,
    id: string,
    status: Status,
  ): Promise<TransactionRow> {
    const { rows } = await db.query<TransactionRow>(
      'UPDATE transactions SET status = $2 WHERE id = $1 RETURNING *',
      [id, status],
    );
    return rows[0]!;
  },

  async lockBalance(db: Queryable, id: string): Promise<number> {
    const { rows } = await db.query<{ balance: string }>(
      'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
      [id],
    );
    return Number(rows[0]!.balance);
  },

  async adjustBalance(db: Queryable, id: string, delta: number): Promise<void> {
    await db.query('UPDATE users SET balance = balance + $2 WHERE id = $1', [id, delta]);
  },
};
