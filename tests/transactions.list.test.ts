import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupApi, USERS } from './fixtures.ts';
import type { Transaction } from '../src/models/transaction.ts';

const api = setupApi();

async function list(userId: string): Promise<Transaction[]> {
  const res = await api.get(`/transactions?userId=${userId}`);
  assert.equal(res.status, 200);
  return (await res.json()) as Transaction[];
}

test('lists transactions where the user is source or destination, ordered by date', async () => {
  await api.post({ source: USERS.alice, destination: USERS.bob, amount: 1000 });
  await api.post({ source: USERS.bob, destination: USERS.alice, amount: 2000 });
  await api.post({ source: USERS.bob, destination: USERS.carol, amount: 3000 });

  const aliceTxs = await list(USERS.alice);
  assert.equal(aliceTxs.length, 2);
  assert.deepEqual(
    aliceTxs.map((t) => t.amount),
    [1000, 2000],
  );

  const carolTxs = await list(USERS.carol);
  assert.equal(carolTxs.length, 1);
  assert.equal(carolTxs[0]?.amount, 3000);
});

test('returns an empty list when the user has no transactions', async () => {
  const txs = await list(USERS.carol);
  assert.deepEqual(txs, []);
});

test('missing userId returns 400', async () => {
  const res = await api.get('/transactions');
  assert.equal(res.status, 400);
});
