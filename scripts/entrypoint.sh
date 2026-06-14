#!/usr/bin/env bash

cd "$(dirname "$0")/.."
docker compose up -d

echo "Database ready. Starting API..."
exec node --env-file=.env index.ts