CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE tx_status AS ENUM ('pending', 'confirmed', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name    TEXT NOT NULL,
  email   TEXT UNIQUE NOT NULL,
  balance NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0)
);

CREATE TABLE IF NOT EXISTS transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          UUID NOT NULL REFERENCES users(id),
  destination     UUID NOT NULL REFERENCES users(id),
  amount          NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  status          tx_status NOT NULL,
  idempotency_key TEXT UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (source <> destination)
);

CREATE INDEX IF NOT EXISTS idx_tx_source      ON transactions (source);
CREATE INDEX IF NOT EXISTS idx_tx_destination ON transactions (destination);

INSERT INTO users (id, name, email, balance) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Alice', 'alice@example.com', 100000.00),
  ('22222222-2222-2222-2222-222222222222', 'Bob',   'bob@example.com',    50000.00),
  ('33333333-3333-3333-3333-333333333333', 'Carol', 'carol@example.com',     0.00)
ON CONFLICT (email) DO NOTHING;
