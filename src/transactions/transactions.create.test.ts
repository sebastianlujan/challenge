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

function post(body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${baseUrl}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

async function getBalance(id: string): Promise<number> {
  const { rows } = await pool.query<{ balance: string }>(
    'SELECT balance FROM users WHERE id = $1',
    [id],
  );
  return Number(rows[0]!.balance);
}

test('small transfer is confirmed and moves funds', async () => {
  const res = await post({ source: USERS.alice, destination: USERS.bob, amount: 10000 });
  assert.equal(res.status, 201);
  const tx = (await res.json()) as Transaction;
  assert.equal(tx.status, 'confirmed');
  assert.equal(await getBalance(USERS.alice), 90000);
  assert.equal(await getBalance(USERS.bob), 60000);
});

test('large transfer is pending and does not move funds', async () => {
  const res = await post({ source: USERS.alice, destination: USERS.bob, amount: 60000 });
  assert.equal(res.status, 201);
  const tx = (await res.json()) as Transaction;
  assert.equal(tx.status, 'pending');
  assert.equal(await getBalance(USERS.alice), 100000);
  assert.equal(await getBalance(USERS.bob), 50000);
});

test('idempotent replay returns the same tx and debits once', async () => {
  const headers = { 'Idempotency-Key': 'key-1' };
  const first = await post({ source: USERS.alice, destination: USERS.bob, amount: 5000 }, headers);
  assert.equal(first.status, 201);
  const firstTx = (await first.json()) as Transaction;

  const second = await post({ source: USERS.alice, destination: USERS.bob, amount: 5000 }, headers);
  assert.equal(second.status, 200);
  const secondTx = (await second.json()) as Transaction;

  assert.equal(secondTx.id, firstTx.id);
  assert.equal(await getBalance(USERS.alice), 95000);
  assert.equal(await getBalance(USERS.bob), 55000);
});

test('insufficient balance returns 422 and moves nothing', async () => {
  const res = await post({ source: USERS.carol, destination: USERS.bob, amount: 100 });
  assert.equal(res.status, 422);
  assert.equal(await getBalance(USERS.carol), 0);
  assert.equal(await getBalance(USERS.bob), 50000);
});

test('non-existent user returns 404', async () => {
  const res = await post({
    source: '99999999-9999-9999-9999-999999999999',
    destination: USERS.bob,
    amount: 100,
  });
  assert.equal(res.status, 404);
});

test('invalid amount returns 400', async () => {
  const res = await post({ source: USERS.alice, destination: USERS.bob, amount: -5 });
  assert.equal(res.status, 400);
});

test('same source and destination returns 400', async () => {
  const res = await post({ source: USERS.alice, destination: USERS.alice, amount: 5 });
  assert.equal(res.status, 400);
});

test('malformed uuid returns 400', async () => {
  const res = await post({ source: 'not-a-uuid', destination: USERS.bob, amount: 5 });
  assert.equal(res.status, 400);
});
