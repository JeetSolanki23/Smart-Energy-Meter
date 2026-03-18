# Smart Energy Meter (Prototype)

# IoT Hardware & Firmware Documentation

Version: 1.0
Device Controller: **ESP32**

This document describes the **hardware design, firmware logic, device workflow, and API communication** for the Smart Energy Meter prototype.

---

# 1. System Overview

The smart meter device measures **DC voltage, current, and power consumption** using an **INA219 sensor**, controlled by an **ESP32 microcontroller**.

The device communicates with the backend server via **WiFi** and reports energy data every **60 seconds**.

Main features:

```text
Energy monitoring
WiFi connectivity
Relay-based power control
OLED display
Device pairing system
Tamper detection
```

---

# 2. Hardware Architecture

```
Power Supply (5V Adapter)
        │
        ▼
      ESP32
   ┌────┼───────────────┐
   │    │               │
 INA219  OLED Display   Relay Module
   │                    │
   ▼                    ▼
Load Power Line     Power Cut Control
```

---

# 3. Component List (BOM)

| Component               | Purpose                         |
| ----------------------- | ------------------------------- |
| ESP32                   | Main controller                 |
| INA219 Module           | Voltage and current measurement |
| 1.3" OLED Display (I2C) | Display device status           |
| 5V Relay Module         | Control power to load           |
| 5V Adapter              | Power supply                    |
| Tamper Switch           | Detect box opening              |
| DC Load                 | Test load                       |

---

# 4. ESP32 Pin Mapping

Recommended pin configuration:

| Component     | ESP32 Pin |
| ------------- | --------- |
| INA219 SDA    | GPIO 21   |
| INA219 SCL    | GPIO 22   |
| OLED SDA      | GPIO 21   |
| OLED SCL      | GPIO 22   |
| Relay Control | GPIO 18   |
| Tamper Switch | GPIO 19   |

Notes:

```text
INA219 and OLED share I2C bus
Use internal pull-up for tamper switch
```

---

# 5. INA219 Measurement

INA219 provides:

```
Voltage (V)
Current (A)
Power (W)
```

Energy calculation:

```
Energy (Wh) = Power × Time
```

Example:

```
Power = 20W
Interval = 60 sec

Energy = 20 × (60/3600)
= 0.33 Wh
```

Device accumulates energy locally before sending.

---

# 6. OLED Display Content

Display states:

### Boot Screen

```
Smart Energy Meter
Initializing...
```

---

### Pair Mode (First Setup)

```
Smart Energy Meter
PAIR CODE: 482913
Waiting Activation
```

---

### Active Mode

Display:

```
Voltage: 12.1V
Current: 1.5A
Power: 18.1W
Units: 0.023
```

---

### Tamper Alert

```
TAMPER DETECTED
Meter Opened
```

---

# 7. WiFi Setup Mode

Device starts in **WiFi configuration mode** if WiFi credentials are missing.

ESP32 creates hotspot:

```
SSID: SmartMeter_Setup
Password: 12345678
```

User connects and opens:

```
http://192.168.4.1
```

Configuration page allows entering:

```
WiFi SSID
WiFi Password
```

Credentials stored in:

```
ESP32 NVS
```

---

# 8. Device Pairing Workflow

### Step 1 – Device Boot

Device calls:

```
POST /api/v1/device/pair/init
```

Request:

```json
{
 "device_uid": "ESP32_MAC_ADDRESS"
}
```

Server returns:

```json
{
 "pair_code": "482913",
 "expires_in": 600
}
```

OLED displays pair code.

---

### Step 2 – Admin Registers Device

Admin uses:

```
POST /api/v1/admin/device/register
```

Payload:

```json
{
 "pair_code": "482913",
 "location": "Room 201",
 "user_id": "uuid"
}
```

Device status becomes:

```
PENDING_ACTIVATION
```

---

### Step 3 – Admin Activates Device

Endpoint:

```
POST /api/v1/admin/device/activate
```

---

### Step 4 – Device Fetch Credentials

Device calls:

```
POST /api/v1/device/activate
```

Request:

```json
{
 "device_uid": "ESP32_MAC_ADDRESS"
}
```

Response:

```json
{
 "device_id": "DEV_000001",
 "device_secret": "secret",
 "status": "ACTIVE"
}
```

Device stores credentials in:

```
ESP32 NVS
```

---

# 9. Device Data Reporting

Every **60 seconds** device sends reading.

Endpoint:

```
POST /api/v1/device/data
```

Header:

```
Authorization: Bearer <device_secret>
```

Payload:

```json
{
 "device_id": "DEV_000001",
 "voltage": 12.1,
 "current": 1.5,
 "power": 18.2,
 "energy": 0.00033,
 "tamper": false,
 "timestamp": "2026-03-18T12:00:00Z"
}
```

Server response:

```json
{
 "status": "ok"
}
```

---

# 10. Relay Control Logic

Relay allows **remote power cutoff**.

Device polls server every 60 seconds.

Endpoint:

```
GET /api/v1/device/command
```

Header:

```
Authorization: Bearer <device_secret>
```

Response example:

```json
{
 "relay": "OFF"
}
```

Device actions:

```
ON  → Enable power
OFF → Disable power
```

Relay connected to load power line.

---

# 11. Tamper Detection

Tamper detection uses **box open switch**.

Switch connected to:

```
GPIO 19
```

Logic:

```
Closed = normal
Open = tamper
```

When tamper detected:

Device sends:

```json
{
 "tamper": true
}
```

Backend logs tamper event.

OLED displays tamper warning.

---

# 12. Device Boot Logic

Firmware startup sequence:

```
Boot
↓
Load WiFi credentials
↓
Connect WiFi
↓
Load device credentials
↓
If credentials missing → pairing mode
↓
Else → active mode
↓
Start measurement loop
```

---

# 13. Measurement Loop

Main loop every **60 seconds**:

```
Read voltage
Read current
Calculate power
Calculate energy
Check tamper switch
Send data to server
Check relay command
Update OLED display
```

---

# 14. Firmware Modules

Recommended firmware structure:

```
main.cpp
wifi_manager.cpp
device_pairing.cpp
sensor_reader.cpp
energy_calculator.cpp
display_manager.cpp
api_client.cpp
relay_controller.cpp
tamper_detector.cpp
storage_manager.cpp
```

---

# 15. Data Stored in ESP32 NVS

Device stores:

```
wifi_ssid
wifi_password
device_id
device_secret
```

---

# 16. Device Failure Handling

If server unreachable:

```
retry connection
store last readings
send later
```

If authentication fails:

```
clear device credentials
restart pairing mode
```

---

# 17. Firmware Libraries

Recommended libraries:

```
WiFi.h
HTTPClient.h
ArduinoJson
Adafruit_INA219
Adafruit_SSD1306
Preferences (NVS)
```

---

# 18. Development Tools

Recommended environment:

```
PlatformIO
Arduino IDE
```

Board:

```
ESP32 Dev Module
```

---

# 19. Testing Checklist

IoT team must verify:

```
WiFi setup works
Pair code generation works
Admin device registration works
Device activation works
Energy readings correct
Relay control works
Tamper detection works
OLED display updates
Data reporting every 60 sec
```

---

# 20. Final Device Workflow

```
Power ON
↓
Connect WiFi
↓
Generate Pair Code
↓
Admin registers device
↓
Admin activates device
↓
Device receives credentials
↓
Start sending energy data
↓
Relay control & tamper detection active
```
