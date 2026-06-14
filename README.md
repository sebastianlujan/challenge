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

```