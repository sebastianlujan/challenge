import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupApi, USERS } from './fixtures.ts';
import type { Transaction } from '../src/models/transaction.ts';

const api = setupApi();

async function createPending(): Promise<Transaction> {
  const res = await api.post({ source: USERS.alice, destination: USERS.bob, amount: 60000 });
  return (await res.json()) as Transaction;
}

test('approving a pending transaction confirms it and moves funds', async () => {
  const pending = await createPending();
  assert.equal(pending.status, 'pending');

  const res = await api.patch(`/transactions/${pending.id}/approve`);
  assert.equal(res.status, 200);
  const tx = (await res.json()) as Transaction;
  assert.equal(tx.status, 'confirmed');
  assert.equal(await api.getBalance(USERS.alice), 40000);
  assert.equal(await api.getBalance(USERS.bob), 110000);
});

test('approving twice returns 409 the second time', async () => {
  const pending = await createPending();
  const first = await api.patch(`/transactions/${pending.id}/approve`);
  assert.equal(first.status, 200);

  const second = await api.patch(`/transactions/${pending.id}/approve`);
  assert.equal(second.status, 409);
});

test('approving a non-existent transaction returns 404', async () => {
  const res = await api.patch('/transactions/99999999-9999-9999-9999-999999999999/approve');
  assert.equal(res.status, 404);
});
