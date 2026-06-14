import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupApi, USERS } from './fixtures.ts';

const api = setupApi();

test('small transfer is confirmed', async () => {
  const res = await api.post({ source: USERS.alice, destination: USERS.bob, amount: 1000 });
  assert.equal(res.status, 201);
  const tx = (await res.json()) as { status: string };
  assert.equal(tx.status, 'confirmed');
});

test('large transfer is pending, then approve confirms it', async () => {
  const res = await api.post({ source: USERS.alice, destination: USERS.bob, amount: 70000 });
  assert.equal(res.status, 201);
  const pending = (await res.json()) as { id: string; status: string };
  assert.equal(pending.status, 'pending');

  const approved = await api.patch(`/transactions/${pending.id}/approve`);
  assert.equal(approved.status, 200);
  const tx = (await approved.json()) as { status: string };
  assert.equal(tx.status, 'confirmed');
});

test('list returns the transactions for a user', async () => {
  await api.post({ source: USERS.alice, destination: USERS.bob, amount: 1000 });
  const res = await api.get(`/transactions?userId=${USERS.alice}`);
  assert.equal(res.status, 200);
  const txs = await res.json();
  assert.ok(Array.isArray(txs));
});
