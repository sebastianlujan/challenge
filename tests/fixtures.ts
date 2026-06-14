import { before, after, beforeEach } from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';
import { initSchema, pool } from '../src/db/pool.ts';

export const USERS = {
  alice: '11111111-1111-1111-1111-111111111111',
  bob: '22222222-2222-2222-2222-222222222222',
  carol: '33333333-3333-3333-3333-333333333333',
};

export interface TestApi {
  baseUrl: string;
  post(body: object, headers?: Record<string, string>): Promise<Response>;
  get(path: string): Promise<Response>;
  patch(path: string): Promise<Response>;
  getBalance(id: string): Promise<number>;
}

export function setupApi(): TestApi {
  const api = {} as TestApi;
  let close: () => Promise<void>;

  before(async () => {
    await initSchema();
    const server = createApp().listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const { port } = server.address() as AddressInfo;
    const baseUrl = `http://localhost:${port}`;
    close = () => new Promise<void>((resolve) => server.close(() => resolve()));

    api.baseUrl = baseUrl;
    api.post = (body, headers = {}) =>
      fetch(`${baseUrl}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
    api.get = (path) => fetch(`${baseUrl}${path}`);
    api.patch = (path) => fetch(`${baseUrl}${path}`, { method: 'PATCH' });
    api.getBalance = async (id) => {
      const { rows } = await pool.query<{ balance: string }>(
        'SELECT balance FROM users WHERE id = $1',
        [id],
      );
      return Number(rows[0]!.balance);
    };
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

  return api;
}
