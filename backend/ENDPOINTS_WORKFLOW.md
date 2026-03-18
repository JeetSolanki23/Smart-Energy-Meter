# API Endpoints and Workflow Guide

## 1. Base Information

- API base: `/api/v1`
- Auth modes:
  - JWT Bearer token for Admin/User
  - Device secret Bearer token for Device endpoints

## 2. Endpoint Catalog

## 2.1 Authentication

### POST `/api/v1/auth/register`
Public user registration.

### POST `/api/v1/auth/login`
Public user login.

### POST `/api/v1/auth/admin/register`
Public admin registration.

### POST `/api/v1/auth/admin/login`
Public admin login.

All login/register responses return:

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer"
}
```

## 2.2 Device

### POST `/api/v1/device/pair/init`
Public route. Generates temporary pair code.

Request:

```json
{
  "device_uid": "84F3EB129ABC"
}
```

Response:

```json
{
  "pair_code": "482913",
  "expires_in": 600
}
```

### POST `/api/v1/device/activate`
Public route. Device fetches credentials after admin registration and activation.

Request:

```json
{
  "device_uid": "84F3EB129ABC"
}
```

Response:

```json
{
  "device_id": "DEV_000001",
  "device_secret": "<secret>",
  "status": "ACTIVE"
}
```

### POST `/api/v1/device/data`
Requires device auth header `Authorization: Bearer <device_secret>`.
Only ACTIVE devices are accepted.

Request:

```json
{
  "device_id": "DEV_000001",
  "voltage": 230.2,
  "current": 1.5,
  "power": 345.3,
  "energy": 0.005,
  "tamper": false,
  "timestamp": "2026-03-17T12:30:00Z"
}
```

Response:

```json
{
  "status": "ok"
}
```

### GET `/api/v1/device/command`
Requires device auth header.
Returns relay command and recommended polling interval.

Response:

```json
{
  "relay": "ON",
  "polling_interval_seconds": 60
}
```

If tampered, relay is forced OFF.

## 2.3 Admin

All admin routes require `Authorization: Bearer <admin_jwt>`.

### GET `/api/v1/admin/pricing`
Returns current unit price.

### PUT `/api/v1/admin/pricing`
Updates unit price.

Request:

```json
{
  "price_per_unit": 8.5
}
```

### GET `/api/v1/admin/device-interval`
Returns current device reporting interval in seconds.

### PUT `/api/v1/admin/device-interval`
Updates device reporting interval.

Request:

```json
{
  "device_data_interval_seconds": 60
}
```

### GET `/api/v1/admin/users/search?q=<text>`
Returns up to 10 matching users by email.

### POST `/api/v1/admin/device/register`
Registers device from pair code.

Request:

```json
{
  "pair_code": "482913",
  "location": "Room 201",
  "user_id": "<uuid>"
}
```

### POST `/api/v1/admin/device/activate`
Activates non-tampered device.

### POST `/api/v1/admin/device/deactivate`
Deactivates device and sets relay OFF.

### POST `/api/v1/admin/device/remove`
Marks device as removed.

### POST `/api/v1/admin/device/recover`
Recovers tampered/non-removed devices; clears tamper lock and sets relay OFF.

### POST `/api/v1/admin/device/relay`
Queues relay command (`ON` or `OFF`) for ACTIVE non-tampered device.

Request:

```json
{
  "device_id": "DEV_000001",
  "relay_state": "OFF"
}
```

### GET `/api/v1/admin/device/list`
Returns device records with health status and last seen timestamp.

## 2.4 User

All user routes require `Authorization: Bearer <user_jwt>`.

### GET `/api/v1/user/pricing`
Returns current unit price.

### GET `/api/v1/user/usage`
Returns current month units from raw telemetry.

### GET `/api/v1/user/usage/daily`
Returns 7-day grouped units by day.

### GET `/api/v1/user/usage/hourly?hours=24`
Returns hourly usage buckets.

### GET `/api/v1/user/usage/live?minutes=60`
Returns minute-level power trend and recent average power.

### GET `/api/v1/user/devices/usage`
Returns per-device usage and health summary.

### GET `/api/v1/user/bills`
Returns user bills.

## 2.5 Payment

### POST `/api/v1/payment/create`
Creates Razorpay order for selected bill.

Request:

```json
{
  "bill_id": "<uuid>"
}
```

Response:

```json
{
  "order_id": "order_xxxxx",
  "amount_paise": 168000,
  "currency": "INR",
  "key_id": "rzp_test_xxxxx"
}
```

### POST `/api/v1/payment/finalize`
Prototype synchronous payment completion.

Request:

```json
{
  "order_id": "order_xxxxx",
  "payment_id": "pay_yyyyy"
}
```

Response:

```json
{
  "status": "success",
  "bill_status": "PAID"
}
```

### POST `/api/v1/payment/webhook`
Razorpay webhook endpoint with signature validation.

## 2.6 Utility

### GET `/health`
Service health status endpoint.

## 3. Workflows

## 3.1 Device Onboarding

1. Device calls `POST /device/pair/init`.
2. Admin searches user with `GET /admin/users/search`.
3. Admin registers device using pair code.
4. Admin activates device.
5. Device calls `POST /device/activate` and stores credentials.
6. Device starts telemetry and command polling.

## 3.2 Telemetry and Tamper

1. Device posts to `POST /device/data`.
2. Backend verifies device secret and ACTIVE state.
3. Reading stored with server receipt timestamp.
4. If tamper is true:
   - status => `DEACTIVATED`
   - relay => `OFF`
   - tamper log inserted
5. Admin can recover using `POST /admin/device/recover`.

## 3.3 Relay Control

1. Admin queues command via `POST /admin/device/relay`.
2. Device polls `GET /device/command`.
3. Backend returns command and polling interval.
4. Pending command is consumed and cleared.

## 3.4 Runtime Configuration

1. Admin updates pricing via `PUT /admin/pricing`.
2. New monthly bills use latest pricing value.
3. Admin updates interval via `PUT /admin/device-interval`.
4. Devices receive updated polling interval in `GET /device/command` response.

## 3.5 Billing and Payments

1. Celery aggregates daily usage.
2. Celery generates monthly bills with dynamic pricing.
3. User requests payment order.
4. Payment is completed via webhook or `/payment/finalize`.
5. Bill status changes to `PAID`.

## 4. Status Enums

### DeviceStatus

- `PENDING_ACTIVATION`
- `ACTIVE`
- `DEACTIVATED`
- `REMOVED`

### BillStatus

- `UNPAID`
- `PAID`
- `OVERDUE`

### PaymentStatus

- `CREATED`
- `SUCCESS`
- `FAILED`
