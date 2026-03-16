# Smart Energy Meter System

## Backend Technical Specification

Version: 1.0
Backend Stack: **Python 3.12 + FastAPI**

---

# 1. System Overview

The Smart Energy Meter system monitors electricity usage using IoT meters (ESP32 + INA219) and provides dashboards for **Admin and Users** to monitor energy consumption and manage billing.

The system consists of:

* **IoT Devices (ESP32 meters)**
* **FastAPI Backend**
* **PostgreSQL Database**
* **Redis Cache**
* **Celery Workers**
* **Razorpay Payment Gateway**
* **Admin Dashboard**
* **User Dashboard**

Main features:

* Smart meter onboarding
* Energy monitoring
* Monthly billing
* Payment integration
* Device lifecycle management
* Tamper detection
* Remote power control

---

# 2. System Architecture

```
ESP32 Meter
   │
   │ REST API (HTTPS)
   ▼
FastAPI Backend
   │
   ├── PostgreSQL (Primary Database)
   ├── Redis (Cache + Celery Broker)
   ├── Celery Worker (Background Jobs)
   │
   ├── Razorpay (Payment Processing)
   │
   ▼
Admin Dashboard / User Dashboard
```

---

# 3. Technology Stack

### Backend

* Python **3.12**
* **FastAPI**
* **Uvicorn**

### Database

* **PostgreSQL**

### ORM

* **SQLAlchemy**

### Cache & Message Broker

* **Redis**

### Background Jobs

* **Celery**

### Payment Gateway

* **Razorpay**

### Deployment

* Docker

---

# 4. User Roles

Two main roles exist in the system.

## Admin

Capabilities:

* Register device
* Activate device
* Deactivate device
* Remove device permanently
* Monitor energy consumption
* Detect tampering
* Cut power remotely
* Configure electricity price

## User

Capabilities:

* Monitor electricity usage
* View bill
* Pay bill
* See unpaid bill alerts

---

# 5. Device Lifecycle

Device states:

```
PENDING_ACTIVATION
ACTIVE
DEACTIVATED
REMOVED
```

### State Description

| State              | Description                 |
| ------------------ | --------------------------- |
| PENDING_ACTIVATION | Device added but not active |
| ACTIVE             | Device operational          |
| DEACTIVATED        | Power cut / disabled        |
| REMOVED            | Device permanently removed  |

---

# 6. Device Onboarding Process

## Step 1 – Device Boot

ESP32 calls:

```
POST /device/pair/init
```

Payload

```json
{
 "device_uid": "84F3EB129ABC"
}
```

Backend generates **pair code**.

Example:

```
482913
```

Stored in **Redis (TTL 10 minutes)**.

Response:

```json
{
 "pair_code": "482913",
 "expires_in": 600
}
```

Device displays pair code on OLED.

---

## Step 2 – Admin Adds Device

Admin enters pair code.

```
POST /admin/device/register
```

Payload:

```json
{
 "pair_code": "482913",
 "location": "Room 201",
 "user_id": 12
}
```

Backend verifies pair code in Redis.

Creates device record.

---

## Step 3 – Device Activation

Admin activates device.

```
POST /admin/device/activate
```

Payload:

```
device_id
```

Server sets status:

```
ACTIVE
```

---

## Step 4 – Device Fetches Credentials

Device calls:

```
POST /device/activate
```

Payload

```json
{
 "device_uid": "84F3EB129ABC"
}
```

Response

```json
{
 "device_id": "DEV_0001",
 "device_secret": "92jf92jf93jf",
 "status": "ACTIVE"
}
```

Device stores credentials locally.

---

# 7. Device Authentication

Each device has:

```
device_id
device_secret
```

All device requests must include header:

```
Authorization: Bearer <device_secret>
```

---

# 8. Device Data Reporting

Device sends data every **60 seconds**.

Endpoint:

```
POST /device/data
```

Payload

```json
{
 "device_id": "DEV_0001",
 "voltage": 230.2,
 "current": 1.5,
 "power": 345.3,
 "energy": 0.005,
 "tamper": false,
 "timestamp": "2026-03-17T12:30:00"
}
```

Server actions:

1. Verify device authentication
2. Store reading
3. Update energy usage
4. Check tamper status

---

# 9. Tamper Detection

ESP32 detects tampering.

Example payload:

```json
{
 "device_id": "DEV_0001",
 "tamper": true
}
```

Server actions:

* Record tamper log
* Mark device tampered
* Display alert in admin dashboard

---

# 10. Remote Relay Control

Admin can control relay.

Endpoint:

```
POST /admin/device/relay
```

Payload

```json
{
 "device_id": "DEV_0001",
 "relay_state": "OFF"
}
```

Device periodically fetches commands.

```
GET /device/command
```

Response

```json
{
 "relay": "OFF"
}
```

---

# 11. Energy Calculation

Energy is calculated as:

```
Energy (kWh) = Power × Time
```

Example:

```
300W × 1 hour = 0.3 kWh
```

Usage stored in:

* raw readings
* daily summaries

---

# 12. Billing System

Bills are generated **monthly**.

Celery job runs:

```
generate_monthly_bills
```

Process:

1. Calculate monthly units
2. Multiply by price per unit
3. Create bill record

Example:

```
Units: 240
Price/unit: ₹7
Total: ₹1680
```

---

# 13. Razorpay Payment Flow

User clicks **Pay Bill**.

Flow:

```
User → Backend
Backend → Razorpay order
User → Razorpay payment page
Razorpay → Webhook → Backend
Backend → Mark bill PAID
```

Webhook endpoint:

```
POST /payment/webhook
```

---

# 14. Unpaid Bill Alert

Each bill has:

```
due_date
```

Celery task runs daily:

```
check_unpaid_bills
```

If bill unpaid:

```
status = OVERDUE
```

User dashboard shows alert.

---

# 15. Database Schema

## Users

```
users
```

| field         | type      |
| ------------- | --------- |
| id            | UUID      |
| email         | string    |
| password_hash | string    |
| created_at    | timestamp |

---

## Admins

```
admins
```

| field         | type   |
| ------------- | ------ |
| id            | UUID   |
| email         | string |
| password_hash | string |

---

## Devices

```
devices
```

| field         | type      |
| ------------- | --------- |
| id            | UUID      |
| device_id     | string    |
| device_uid    | string    |
| device_secret | string    |
| user_id       | UUID      |
| status        | enum      |
| location      | string    |
| relay_state   | boolean   |
| created_at    | timestamp |

---

## Energy Readings

```
energy_readings
```

| field     | type      |
| --------- | --------- |
| id        | UUID      |
| device_id | UUID      |
| voltage   | float     |
| current   | float     |
| power     | float     |
| energy    | float     |
| timestamp | timestamp |

---

## Daily Usage

```
daily_usage
```

| field          | type  |
| -------------- | ----- |
| id             | UUID  |
| device_id      | UUID  |
| date           | date  |
| units_consumed | float |

---

## Bills

```
bills
```

| field    | type  |
| -------- | ----- |
| id       | UUID  |
| user_id  | UUID  |
| month    | date  |
| units    | float |
| amount   | float |
| status   | enum  |
| due_date | date  |

---

## Payments

```
payments
```

| field               | type      |
| ------------------- | --------- |
| id                  | UUID      |
| bill_id             | UUID      |
| razorpay_payment_id | string    |
| amount              | float     |
| status              | enum      |
| paid_at             | timestamp |

---

## Tamper Logs

```
tamper_logs
```

| field       | type      |
| ----------- | --------- |
| id          | UUID      |
| device_id   | UUID      |
| timestamp   | timestamp |
| description | string    |

---

# 16. Celery Background Tasks

Tasks include:

### Monthly Bill Generation

```
generate_monthly_bills
```

Runs monthly.

---

### Daily Usage Aggregation

```
aggregate_daily_usage
```

Runs daily.

---

### Unpaid Bill Check

```
check_unpaid_bills
```

Runs daily.

---

# 17. Security

* HTTPS only
* Device authentication via device_secret
* Admin/User authentication via JWT
* Passwords hashed with bcrypt

---

# 18. API Summary

### Authentication

```
POST /auth/login
POST /auth/register
```

### Admin

```
POST /admin/device/register
POST /admin/device/activate
POST /admin/device/deactivate
POST /admin/device/remove
POST /admin/device/relay
GET /admin/device/list
```

### Device

```
POST /device/pair/init
POST /device/activate
POST /device/data
GET /device/command
```

### User

```
GET /user/usage
GET /user/bills
POST /payment/create
```

### Payment

```
POST /payment/webhook
```

---

# 19. Logging & Monitoring

System should log:

* device connections
* energy readings
* tamper alerts
* payments
* admin actions

Recommended tools:

* Prometheus
* Grafana

---

# 20. Deployment

Recommended structure:

```
backend/
 ├── app
 ├── models
 ├── routers
 ├── services
 ├── celery_tasks
 ├── database
 └── main.py
```

Services:

* FastAPI container
* PostgreSQL container
* Redis container
* Celery worker container
