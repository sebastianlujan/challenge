import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../app.ts';
import { initSchema, pool } from '../db.ts';
import type { Transaction } from './types.ts';

const USERS = {
  alice: '11111111-1111-1111-1111-111111111111',
  bob: '22222222-2222-2222-2222-222222222222',
  carol: '33333333-3333-3333-3333-333333333333',
};

let baseUrl: string;
let close: () => Promise<void>;

before(async () => {
  await initSchema();
  const server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://localhost:${port}`;
  close = () => new Promise<void>((resolve) => server.close(() => resolve()));
});

after(async () => {
  await close();
  await pool.end();
});

beforeEach(async () => {
  await pool.query('TRUNCATE transactions');
  await pool.query('UPDATE users SET balance = 100000 WHERE id = $1', [USERS.alice]);
  await pool.query('UPDATE users SET balance = 50000 WHERE id = $1', [USERS.bob]);
  await pool.query('UPDATE users SET balance = 0 WHERE id = $1', [USERS.carol]);
});

async function createPending(): Promise<Transaction> {
  const res = await fetch(`${baseUrl}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: USERS.alice, destination: USERS.bob, amount: 60000 }),
  });
  return (await res.json()) as Transaction;
}

function reject(id: string) {
  return fetch(`${baseUrl}/transactions/${id}/reject`, { method: 'PATCH' });
}

async function getBalance(id: string): Promise<number> {
  const { rows } = await pool.query<{ balance: string }>(
    'SELECT balance FROM users WHERE id = $1',
    [id],
  );
  return Number(rows[0]!.balance);
}

test('rejecting a pending transaction marks it rejected and keeps balances', async () => {
  const pending = await createPending();
  assert.equal(pending.status, 'pending');

  const res = await reject(pending.id);
  assert.equal(res.status, 200);
  const tx = (await res.json()) as Transaction;
  assert.equal(tx.status, 'rejected');
  assert.equal(await getBalance(USERS.alice), 100000);
  assert.equal(await getBalance(USERS.bob), 50000);
});

test('rejecting a confirmed transaction returns 409', async () => {
  const res = await fetch(`${baseUrl}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: USERS.alice, destination: USERS.bob, amount: 1000 }),
  });
  const confirmed = (await res.json()) as Transaction;
  assert.equal(confirmed.status, 'confirmed');

  const rejected = await reject(confirmed.id);
  assert.equal(rejected.status, 409);
});

test('rejecting a non-existent transaction returns 404', async () => {
  const res = await reject('99999999-9999-9999-9999-999999999999');
  assert.equal(res.status, 404);
});
