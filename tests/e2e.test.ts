import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';
import { initSchema, pool } from '../src/db/pool.ts';

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

function post(body: object) {
  return fetch(`${baseUrl}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('small transfer is confirmed', async () => {
  const res = await post({ source: USERS.alice, destination: USERS.bob, amount: 1000 });
  assert.equal(res.status, 201);
  const tx = (await res.json()) as { status: string };
  assert.equal(tx.status, 'confirmed');
});

test('large transfer is pending, then approve confirms it', async () => {
  const res = await post({ source: USERS.alice, destination: USERS.bob, amount: 70000 });
  assert.equal(res.status, 201);
  const pending = (await res.json()) as { id: string; status: string };
  assert.equal(pending.status, 'pending');

  const approved = await fetch(`${baseUrl}/transactions/${pending.id}/approve`, {
    method: 'PATCH',
  });
  assert.equal(approved.status, 200);
  const tx = (await approved.json()) as { status: string };
  assert.equal(tx.status, 'confirmed');
});

test('list returns the transactions for a user', async () => {
  await post({ source: USERS.alice, destination: USERS.bob, amount: 1000 });
  const res = await fetch(`${baseUrl}/transactions?userId=${USERS.alice}`);
  assert.equal(res.status, 200);
  const txs = await res.json();
  assert.ok(Array.isArray(txs));
});
