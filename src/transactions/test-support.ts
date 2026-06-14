import type { AddressInfo } from 'node:net';
import { createApp } from '../app.ts';
import { initSchema, pool } from '../db.ts';

export const USERS = {
  alice: '11111111-1111-1111-1111-111111111111',
  bob: '22222222-2222-2222-2222-222222222222',
  carol: '33333333-3333-3333-3333-333333333333',
};

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  await initSchema();
  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://localhost:${port}`,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
}

export async function resetDb(): Promise<void> {
  await pool.query('TRUNCATE transactions');
  await pool.query('UPDATE users SET balance = 100000 WHERE id = $1', [USERS.alice]);
  await pool.query('UPDATE users SET balance = 50000 WHERE id = $1', [USERS.bob]);
  await pool.query('UPDATE users SET balance = 0 WHERE id = $1', [USERS.carol]);
}

export async function getBalance(id: string): Promise<number> {
  const { rows } = await pool.query<{ balance: string }>(
    'SELECT balance FROM users WHERE id = $1',
    [id],
  );
  return Number(rows[0]!.balance);
}
