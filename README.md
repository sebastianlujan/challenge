# Mini Plataforma Fintech

```sh

ALGUNAS NOTAS:

UserID: nombre, email, saldo
transactionID: origen, destino, monto , estado ( pendiente, confirmada, rechazada), fecha

- POST /transactions ( creo debe ser idempotente.. )

Origen y destino deben existir
Origen debe de tener salido
    si monto > 50_000 => pendiente (verificacion manual)
    si monto <= 50_000 => se debita/acredita

- GET /transactions?userId=...
    lista las tx de un usuario como origen o destino, ordenadas por fecha

- PATCH /transactions/:id/approve
    confirma una transaccion pendiente y realiza el movimiento de fondos
    solo puede usarse si el estado es pendiente

- PATCH /transactions/:id/reject
    rechaza una tx pendiente, no modifica saldos.

Negocio:
    ningun usuario puede tener saldo negativo
    las tx deben ser ACID, atomicas, si falla el credito o debito no debe quedar en estado parcial
    ->->->  Idempotencia: las tx son idempotentes, no hay doble cobro o doble gasto (obvio)
    Debe de quedar un registro claro de cada operacion y su efecto sobre su saldo

son cuentas virtuales en pesos a usuarios , un usuario puede tener dinero en su cuenta
enviar pagos a otros usuarios => hacer una api para enrutar y validar pagos internos , aca vale enviar una idempotency-key en el header para tener un solo pago y autorizacion probablemente de un bearer token.

- también todo esto hay que persistirlo en BD , con postgresql.


```

---

## Ejecución

Se necesita Node 24+ y Docker.

```sh
npm install
npm run db:up    # Postgres en Docker
npm start        # API en http://localhost:3001
npm test         # corre los tests (con la db arriba)
```

Ejemplo:

```sh
A=11111111-1111-1111-1111-111111111111
B=22222222-2222-2222-2222-222222222222

curl -X POST http://localhost:3001/transactions \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: pago-1' \
  -d "{\"source\":\"$A\",\"destination\":\"$B\",\"amount\":1000}"

curl "http://localhost:3001/transactions?userId=$A"
```

---

## API

Base URL: `http://localhost:3001`. Todo es JSON (`Content-Type: application/json`).

Una transacción se ve así:

```json
{
  "id": "uuid",
  "source": "uuid",
  "destination": "uuid",
  "amount": 1000,
  "status": "pending | confirmed | rejected",
  "createdAt": "2026-06-14T06:24:49.921Z"
}
```

### POST /transactions

Crea una transferencia. Idempotente con el header `Idempotency-Key` (si repetís la
misma key, te devuelve la misma tx sin volver a cobrar).

- Body: `{ "source": uuid, "destination": uuid, "amount": number }`
- `amount > 50000` → queda `pending` (no mueve saldos, requiere approve).
- `amount <= 50000` → debita origen / acredita destino → `confirmed`.
- Respuestas: `201` creada · `200` replay idempotente · `400` input inválido ·
  `404` origen/destino no existe · `422` saldo insuficiente.

### GET /transactions?userId=:id

Lista las transacciones donde el usuario es `source` o `destination`, ordenadas
por fecha.

- Respuestas: `200` con el array
- `400` si falta o es inválido el `userId`.

### PATCH /transactions/:id/approve

Confirma una transacción `pending` y recién ahí mueve los fondos.

- Respuestas: `200` confirmada,
- `404` no existe, `409` no está pendiente ·
- `422` saldo insuficiente.

### PATCH /transactions/:id/reject

Rechaza una transacción `pending`. No toca saldos.

- Respuestas: `200` rechazada , `404` no existe, `409` no está pendiente.
