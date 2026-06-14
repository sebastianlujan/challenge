import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupApi, USERS } from './fixtures.ts';
import type { Transaction } from '../src/models/transaction.ts';

const api = setupApi();

async function createPending(): Promise<Transaction> {
  const res = await api.post({ source: USERS.alice, destination: USERS.bob, amount: 60000 });
  return (await res.json()) as Transaction;
}

test('rejecting a pending transaction marks it rejected and keeps balances', async () => {
  const pending = await createPending();
  assert.equal(pending.status, 'pending');

  const res = await api.patch(`/transactions/${pending.id}/reject`);
  assert.equal(res.status, 200);
  const tx = (await res.json()) as Transaction;
  assert.equal(tx.status, 'rejected');
  assert.equal(await api.getBalance(USERS.alice), 100000);
  assert.equal(await api.getBalance(USERS.bob), 50000);
});

test('rejecting a confirmed transaction returns 409', async () => {
  const res = await api.post({ source: USERS.alice, destination: USERS.bob, amount: 1000 });
  const confirmed = (await res.json()) as Transaction;
  assert.equal(confirmed.status, 'confirmed');

  const rejected = await api.patch(`/transactions/${confirmed.id}/reject`);
  assert.equal(rejected.status, 409);
});

test('rejecting a non-existent transaction returns 404', async () => {
  const res = await api.patch('/transactions/99999999-9999-9999-9999-999999999999/reject');
  assert.equal(res.status, 404);
});
