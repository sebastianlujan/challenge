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

function post(body: unknown) {
  return fetch(`${baseUrl}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function list(userId: string): Promise<Transaction[]> {
  const res = await fetch(`${baseUrl}/transactions?userId=${userId}`);
  assert.equal(res.status, 200);
  return (await res.json()) as Transaction[];
}

test('lists transactions where the user is source or destination, ordered by date', async () => {
  await post({ source: USERS.alice, destination: USERS.bob, amount: 1000 });
  await post({ source: USERS.bob, destination: USERS.alice, amount: 2000 });
  await post({ source: USERS.bob, destination: USERS.carol, amount: 3000 });

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
  const res = await fetch(`${baseUrl}/transactions`);
  assert.equal(res.status, 400);
});
