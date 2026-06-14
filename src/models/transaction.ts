export type Status = 'pending' | 'confirmed' | 'rejected';

export interface TransactionRow {
  id: string;
  source: string;
  destination: string;
  amount: string;
  status: Status;
  idempotency_key: string | null;
  created_at: Date;
}

export interface Transaction {
  id: string;
  source: string;
  destination: string;
  amount: number;
  status: Status;
  createdAt: Date;
}

export function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    source: row.source,
    destination: row.destination,
    amount: Number(row.amount),
    status: row.status,
    createdAt: row.created_at,
  };
}
