# Smart Energy Meter ESP32 Firmware (Arduino IDE)

## 1) Arduino IDE Setup

Use these settings:

- Board: ESP32 Dev Module
- Upload speed: 921600 (or 115200 if unstable)
- Flash frequency: 80MHz
- Partition scheme: Default

## 2) Install Libraries

In Arduino IDE Library Manager, install:

- ArduinoJson (by Benoit Blanchon)
- Adafruit INA219 (by Adafruit)
- Adafruit SSD1306 (by Adafruit)
- Adafruit GFX Library (by Adafruit)

## 3) Wiring

- INA219 SDA -> GPIO 21
- INA219 SCL -> GPIO 22
- OLED SDA -> GPIO 21
- OLED SCL -> GPIO 22
- Relay IN -> GPIO 18
- Tamper switch -> GPIO 19 (to GND when closed)

## 4) Backend URL Configuration

Backend URL is now configured from the setup webpage and saved in ESP32 NVS.

In setup page, provide:

- API Base URL (example: http://192.168.1.100:8000/api/v1)

Validation rules in firmware:

- Must start with http:// or https://
- Must include /api/v1
- Spaces are not allowed

Setup page also includes:

- Reset API URL to Default button
- This resets only API URL (keeps WiFi credentials unchanged)

## 5) First Boot Flow

- If WiFi credentials are missing, ESP32 starts AP mode:
  - SSID: SmartMeter_Setup
  - Password: 12345678
  - Open: http://192.168.4.1
- Save WiFi credentials and API Base URL.
- Device requests pair code and displays it on OLED.
- Admin registers/activates device from backend.
- Device receives device_id and device_secret and starts reporting every 60 seconds.

## 6) Notes

- If API returns 401/403, firmware clears device credentials and returns to pairing mode.
- If server is temporarily unreachable, readings are buffered in RAM and retried.
- Timestamp is a placeholder (1970-01-01T00:00:00Z). If your backend requires real time, add NTP sync.
- BOOT button (GPIO0) factory reset: press and hold for 5 seconds to clear WiFi, API URL, and device credentials, then restart into fresh setup/pairing flow.
- OLED values refresh every 1 second (live view), while backend upload/relay polling continues on configured interval (default 60 seconds or server-provided interval).
