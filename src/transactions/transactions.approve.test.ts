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

function approve(id: string) {
  return fetch(`${baseUrl}/transactions/${id}/approve`, { method: 'PATCH' });
}

async function getBalance(id: string): Promise<number> {
  const { rows } = await pool.query<{ balance: string }>(
    'SELECT balance FROM users WHERE id = $1',
    [id],
  );
  return Number(rows[0]!.balance);
}

test('approving a pending transaction confirms it and moves funds', async () => {
  const pending = await createPending();
  assert.equal(pending.status, 'pending');

  const res = await approve(pending.id);
  assert.equal(res.status, 200);
  const tx = (await res.json()) as Transaction;
  assert.equal(tx.status, 'confirmed');
  assert.equal(await getBalance(USERS.alice), 40000);
  assert.equal(await getBalance(USERS.bob), 110000);
});

test('approving twice returns 409 the second time', async () => {
  const pending = await createPending();
  const first = await approve(pending.id);
  assert.equal(first.status, 200);

  const second = await approve(pending.id);
  assert.equal(second.status, 409);
});

test('approving a non-existent transaction returns 404', async () => {
  const res = await approve('99999999-9999-9999-9999-999999999999');
  assert.equal(res.status, 404);
});
