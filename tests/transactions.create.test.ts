import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupApi, USERS } from './fixtures.ts';
import type { Transaction } from '../src/models/transaction.ts';

const api = setupApi();

test('small transfer is confirmed and moves funds', async () => {
  const res = await api.post({ source: USERS.alice, destination: USERS.bob, amount: 10000 });
  assert.equal(res.status, 201);
  const tx = (await res.json()) as Transaction;
  assert.equal(tx.status, 'confirmed');
  assert.equal(await api.getBalance(USERS.alice), 90000);
  assert.equal(await api.getBalance(USERS.bob), 60000);
});

test('large transfer is pending and does not move funds', async () => {
  const res = await api.post({ source: USERS.alice, destination: USERS.bob, amount: 60000 });
  assert.equal(res.status, 201);
  const tx = (await res.json()) as Transaction;
  assert.equal(tx.status, 'pending');
  assert.equal(await api.getBalance(USERS.alice), 100000);
  assert.equal(await api.getBalance(USERS.bob), 50000);
});

test('idempotent replay returns the same tx and debits once', async () => {
  const headers = { 'Idempotency-Key': 'key-1' };
  const first = await api.post({ source: USERS.alice, destination: USERS.bob, amount: 5000 }, headers);
  assert.equal(first.status, 201);
  const firstTx = (await first.json()) as Transaction;

  const second = await api.post({ source: USERS.alice, destination: USERS.bob, amount: 5000 }, headers);
  assert.equal(second.status, 200);
  const secondTx = (await second.json()) as Transaction;

  assert.equal(secondTx.id, firstTx.id);
  assert.equal(await api.getBalance(USERS.alice), 95000);
  assert.equal(await api.getBalance(USERS.bob), 55000);
});

test('insufficient balance returns 422 and moves nothing', async () => {
  const res = await api.post({ source: USERS.carol, destination: USERS.bob, amount: 100 });
  assert.equal(res.status, 422);
  assert.equal(await api.getBalance(USERS.carol), 0);
  assert.equal(await api.getBalance(USERS.bob), 50000);
});

test('non-existent user returns 404', async () => {
  const res = await api.post({
    source: '99999999-9999-9999-9999-999999999999',
    destination: USERS.bob,
    amount: 100,
  });
  assert.equal(res.status, 404);
});

test('invalid amount returns 400', async () => {
  const res = await api.post({ source: USERS.alice, destination: USERS.bob, amount: -5 });
  assert.equal(res.status, 400);
});

test('same source and destination returns 400', async () => {
  const res = await api.post({ source: USERS.alice, destination: USERS.alice, amount: 5 });
  assert.equal(res.status, 400);
});

test('malformed uuid returns 400', async () => {
  const res = await api.post({ source: 'not-a-uuid', destination: USERS.bob, amount: 5 });
  assert.equal(res.status, 400);
});
