#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Preferences.h>
#include <ctime>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_INA219.h>

// ---------------------------
// Smart Energy Meter - ESP32
// ---------------------------
// Hardware mapping from IoT Hardware.md:
// INA219 SDA/SCL: GPIO 21/22
// OLED SDA/SCL: GPIO 21/22
// Relay: GPIO 18
// Tamper switch: GPIO 19 (INPUT_PULLUP, HIGH = tamper/open)

// -------- User Config --------
const char* API_BASE_URL_DEFAULT = "http://192.168.1.100:8000/api/v1";
const uint32_t DEFAULT_REPORT_INTERVAL_MS = 20000;
const uint32_t LIVE_REFRESH_INTERVAL_MS = 1000;
const uint16_t HTTP_TIMEOUT_MS = 8000;

// NTP Configuration for real-time synchronization
const char* NTP_SERVER_1 = "pool.ntp.org";
const char* NTP_SERVER_2 = "time.nist.gov";
const long GMT_OFFSET_SEC = 0;           // UTC+0 (adjust as needed, e.g., 5*3600 for UTC+5)
const int DAYLIGHT_OFFSET_SEC = 0;       // DST offset if applicable

const char* SETUP_AP_SSID = "SmartMeter_Setup";
const char* SETUP_AP_PASSWORD = "12345678";

uint32_t pollIntervalMs = DEFAULT_REPORT_INTERVAL_MS;   // Dynamic polling interval (fetched from server)

// -------- Pin Config --------
const int RELAY_PIN = 18;
const int TAMPER_PIN = 19;
const int BOOT_BUTTON_PIN = 0;
const uint32_t FACTORY_RESET_HOLD_MS = 5000;

// -------- OLED Config --------
const int SCREEN_WIDTH = 128;
const int SCREEN_HEIGHT = 64;
const int OLED_RESET = -1;
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// -------- Sensors --------
Adafruit_INA219 ina219;

// -------- WiFi Setup Portal --------
WebServer setupServer(80);

// -------- NVS --------
Preferences prefs;

// -------- Device State --------
String wifiSsid;
String wifiPassword;
String apiBaseUrl;
String deviceId;
String deviceSecret;
String pairCode;
String deviceUid;

bool paired = false;
bool relayOn = true;
float totalEnergyWh = 0.0f;
unsigned long lastLoopMs = 0;
unsigned long lastDisplayMs = 0;
unsigned long lastSampleMs = 0;
bool resetPressActive = false;
bool resetTriggered = false;
unsigned long resetPressStartMs = 0;
bool hasLiveSample = false;
float liveVoltage = 0.0f;
float liveCurrent = 0.0f;
float livePower = 0.0f;
bool liveTamper = false;
String liveTimestamp = "1970-01-01T00:00:00Z";

// Small RAM buffer for offline readings
struct Reading {
  float voltage;
  float current;
  float power;
  float energy;
  bool tamper;
  String timestamp;
};

const int MAX_BUFFERED_READINGS = 20;
Reading readingBuffer[MAX_BUFFERED_READINGS];
int bufferCount = 0;

// Forward declarations for functions used before their definitions
void showLines(const String& l1, const String& l2 = "", const String& l3 = "", const String& l4 = "");

// -------- Utility --------
String nowIso8601() {
  // Return current time synchronized via NTP
  time_t now = time(nullptr);
  struct tm* timeinfo = gmtime(&now);
  char buffer[30];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", timeinfo);
  return String(buffer);
}

void syncNtp() {
  // Synchronize time with NTP servers
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER_1, NTP_SERVER_2);
  
  showLines("Syncing NTP...", "Getting time");
  
  // Wait for NTP sync (max 20 seconds)
  time_t now = time(nullptr);
  int attempts = 0;
  while (now < 24 * 3600 && attempts < 40) {
    delay(500);
    now = time(nullptr);
    attempts++;
  }
  
  if (now > 24 * 3600) {
    struct tm* timeinfo = localtime(&now);
    char buffer[20];
    strftime(buffer, sizeof(buffer), "%Y-%m-%d %H:%M", timeinfo);
    showLines("NTP Synced", String(buffer));
  } else {
    showLines("NTP Failed", "Using default");
  }
  delay(1000);
}

void showLines(const String& l1, const String& l2, const String& l3, const String& l4) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println(l1);
  if (l2.length()) display.println(l2);
  if (l3.length()) display.println(l3);
  if (l4.length()) display.println(l4);
  display.display();
}

void saveString(const char* key, const String& value) {
  prefs.putString(key, value);
}

String loadString(const char* key) {
  return prefs.getString(key, "");
}

String trimApiBaseUrl(const String& input) {
  String url = input;
  url.trim();
  while (url.endsWith("/")) {
    url.remove(url.length() - 1);
  }
  return url;
}

bool isValidApiBaseUrl(const String& url) {
  if (url.length() < 10 || url.length() > 120) return false;
  if (!(url.startsWith("http://") || url.startsWith("https://"))) return false;
  if (url.indexOf(' ') >= 0) return false;
  if (url.indexOf("/api/v1") < 0) return false;
  return true;
}

void clearDeviceCredentials() {
  prefs.remove("device_id");
  prefs.remove("device_secret");
  deviceId = "";
  deviceSecret = "";
  paired = false;
}

void factoryResetAndRestart() {
  prefs.remove("wifi_ssid");
  prefs.remove("wifi_pass");
  prefs.remove("api_url");
  prefs.remove("device_id");
  prefs.remove("device_secret");

  wifiSsid = "";
  wifiPassword = "";
  apiBaseUrl = String(API_BASE_URL_DEFAULT);
  deviceId = "";
  deviceSecret = "";
  paired = false;
  bufferCount = 0;
  totalEnergyWh = 0.0f;

  showLines("Factory Reset", "Config cleared", "Restarting...");
  delay(1200);
  ESP.restart();
}

void checkFactoryResetButton() {
  bool pressed = digitalRead(BOOT_BUTTON_PIN) == LOW;
  unsigned long now = millis();

  if (pressed) {
    if (!resetPressActive) {
      resetPressActive = true;
      resetTriggered = false;
      resetPressStartMs = now;
      showLines("Hold BOOT 5s", "for fresh start");
      return;
    }

    if (!resetTriggered && (now - resetPressStartMs >= FACTORY_RESET_HOLD_MS)) {
      resetTriggered = true;
      factoryResetAndRestart();
    }
    return;
  }

  resetPressActive = false;
  resetTriggered = false;
}

void loadCredentials() {
  wifiSsid = loadString("wifi_ssid");
  wifiPassword = loadString("wifi_pass");
  apiBaseUrl = trimApiBaseUrl(loadString("api_url"));
  if (!isValidApiBaseUrl(apiBaseUrl)) {
    apiBaseUrl = String(API_BASE_URL_DEFAULT);
  }
  deviceId = loadString("device_id");
  deviceSecret = loadString("device_secret");
  paired = deviceId.length() > 0 && deviceSecret.length() > 0;
}

void setRelay(bool on) {
  relayOn = on;
  digitalWrite(RELAY_PIN, on ? HIGH : LOW);
}

bool isTamperDetected() {
  // With INPUT_PULLUP: HIGH means switch open (tamper), LOW means normal.
  return digitalRead(TAMPER_PIN) == HIGH;
}

void addBufferedReading(float v, float c, float p, float e, bool t, const String& ts) {
  if (bufferCount < MAX_BUFFERED_READINGS) {
    readingBuffer[bufferCount++] = {v, c, p, e, t, ts};
    return;
  }
  for (int i = 1; i < MAX_BUFFERED_READINGS; i++) {
    readingBuffer[i - 1] = readingBuffer[i];
  }
  readingBuffer[MAX_BUFFERED_READINGS - 1] = {v, c, p, e, t, ts};
}

// -------- WiFi Setup Portal --------
void handleRoot() {
  String currentApi = apiBaseUrl.length() ? apiBaseUrl : String(API_BASE_URL_DEFAULT);
  String html =
    "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
    "<title>Smart Meter Setup</title></head><body>"
    "<h2>Smart Meter Setup</h2>"
    "<form method='POST' action='/save'>"
    "SSID:<br><input name='ssid' required><br><br>"
    "Password:<br><input name='password' type='password' required><br><br>"
    "API Base URL:<br><input name='api_url' value='" + currentApi + "' required><br>"
    "<small>Example: http://192.168.1.100:8000/api/v1</small><br><br>"
    "<button type='submit'>Save</button></form><br>"
    "<form method='POST' action='/reset-api' onsubmit=\"return confirm('Reset API URL to default?');\">"
    "<button type='submit'>Reset API URL to Default</button></form>"
    "</body></html>";
  setupServer.send(200, "text/html", html);
}

void handleSave() {
  if (!setupServer.hasArg("ssid") || !setupServer.hasArg("password") || !setupServer.hasArg("api_url")) {
    setupServer.send(400, "text/plain", "Missing ssid, password, or api_url");
    return;
  }

  String ssid = setupServer.arg("ssid");
  String password = setupServer.arg("password");
  String newApiBaseUrl = trimApiBaseUrl(setupServer.arg("api_url"));

  if (!isValidApiBaseUrl(newApiBaseUrl)) {
    setupServer.send(400, "text/plain", "Invalid API URL. Use http(s)://.../api/v1");
    return;
  }

  saveString("wifi_ssid", ssid);
  saveString("wifi_pass", password);
  saveString("api_url", newApiBaseUrl);

  setupServer.send(200, "text/plain", "Saved. Device will restart.");
  delay(1000);
  ESP.restart();
}

void handleResetApi() {
  saveString("api_url", String(API_BASE_URL_DEFAULT));
  setupServer.send(200, "text/plain", "API URL reset to default. Device will restart.");
  delay(1000);
  ESP.restart();
}

void runWifiSetupPortal() {
  showLines("Smart Energy Meter", "WiFi Setup Mode", "SSID: SmartMeter_Setup", "192.168.4.1");

  WiFi.mode(WIFI_AP);
  WiFi.softAP(SETUP_AP_SSID, SETUP_AP_PASSWORD);

  setupServer.on("/", handleRoot);
  setupServer.on("/save", HTTP_POST, handleSave);
  setupServer.on("/reset-api", HTTP_POST, handleResetApi);
  setupServer.begin();

  while (true) {
    checkFactoryResetButton();
    setupServer.handleClient();
    delay(10);
  }
}

bool connectWifi() {
  if (wifiSsid.length() == 0 || wifiPassword.length() == 0) {
    return false;
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());

  showLines("Connecting WiFi...", wifiSsid);

  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(400);
  }

  return WiFi.status() == WL_CONNECTED;
}

// -------- HTTP Helpers --------
bool httpPostJson(const String& url, const String& authBearer, const String& payload, int& httpCode, String& responseBody) {
  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  if (authBearer.length()) {
    http.addHeader("Authorization", "Bearer " + authBearer);
  }

  httpCode = http.POST(payload);
  if (httpCode > 0) {
    responseBody = http.getString();
  } else {
    responseBody = "";
  }
  http.end();
  return httpCode > 0;
}

bool httpGet(const String& url, const String& authBearer, int& httpCode, String& responseBody) {
  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.begin(url);
  if (authBearer.length()) {
    http.addHeader("Authorization", "Bearer " + authBearer);
  }

  httpCode = http.GET();
  if (httpCode > 0) {
    responseBody = http.getString();
  } else {
    responseBody = "";
  }
  http.end();
  return httpCode > 0;
}

// -------- Pairing Flow --------
bool requestPairCode() {
  StaticJsonDocument<256> req;
  req["device_uid"] = deviceUid;

  String payload;
  serializeJson(req, payload);

  int code = 0;
  String body;
  bool ok = httpPostJson(apiBaseUrl + "/device/pair/init", "", payload, code, body);
  if (!ok || code < 200 || code >= 300) {
    return false;
  }

  StaticJsonDocument<512> res;
  DeserializationError err = deserializeJson(res, body);
  if (err) {
    return false;
  }

  if (!res.containsKey("pair_code")) {
    return false;
  }

  pairCode = String((const char*)res["pair_code"]);
  return true;
}

bool activateDevice() {
  StaticJsonDocument<256> req;
  req["device_uid"] = deviceUid;

  String payload;
  serializeJson(req, payload);

  int code = 0;
  String body;
  bool ok = httpPostJson(apiBaseUrl + "/device/activate", "", payload, code, body);
  if (!ok) {
    return false;
  }

  if (code == 404 || code == 409 || code == 423) {
    // Not yet activated by admin.
    return false;
  }

  if (code < 200 || code >= 300) {
    return false;
  }

  StaticJsonDocument<768> res;
  DeserializationError err = deserializeJson(res, body);
  if (err) {
    return false;
  }

  if (!res.containsKey("device_id") || !res.containsKey("device_secret")) {
    return false;
  }

  deviceId = String((const char*)res["device_id"]);
  deviceSecret = String((const char*)res["device_secret"]);

  saveString("device_id", deviceId);
  saveString("device_secret", deviceSecret);
  paired = true;
  return true;
}

void runPairingMode() {
  showLines("Pairing...", "Requesting code");

  while (!requestPairCode()) {
    showLines("Pairing failed", "Retry in 5s");
    delay(5000);
  }

  showLines("PAIR CODE:", pairCode, "Waiting Activation");

  while (!paired) {
    if (activateDevice()) {
      showLines("Activated", deviceId, "Starting...");
      delay(1200);
      break;
    }
    delay(5000);
  }
}

// -------- Telemetry --------
bool sendReading(const Reading& r, bool isBacklog) {
  StaticJsonDocument<512> req;
  req["device_id"] = deviceId;
  req["voltage"] = r.voltage;
  req["current"] = r.current;
  req["power"] = r.power;
  req["energy"] = r.energy;
  req["tamper"] = r.tamper;
  req["timestamp"] = r.timestamp;

  String payload;
  serializeJson(req, payload);

  int code = 0;
  String body;
  bool ok = httpPostJson(apiBaseUrl + "/device/data", deviceSecret, payload, code, body);
  if (!ok) {
    return false;
  }

  if (code == 401 || code == 403) {
    clearDeviceCredentials();
    return false;
  }

  if (code < 200 || code >= 300) {
    return false;
  }

  return true;
}

void flushBacklog() {
  int i = 0;
  while (i < bufferCount) {
    if (!sendReading(readingBuffer[i], true)) {
      break;
    }

    for (int j = i + 1; j < bufferCount; j++) {
      readingBuffer[j - 1] = readingBuffer[j];
    }
    bufferCount--;
  }
}

void pollRelayCommand() {
  int code = 0;
  String body;
  bool ok = httpGet(apiBaseUrl + "/device/command", deviceSecret, code, body);
  if (!ok) return;

  if (code == 401 || code == 403) {
    clearDeviceCredentials();
    return;
  }

  if (code < 200 || code >= 300) {
    return;
  }

  StaticJsonDocument<256> res;
  if (deserializeJson(res, body)) {
    return;
  }

  if (!res.containsKey("relay")) {
    return;
  }

  if (res.containsKey("polling_interval_seconds")) {
    uint32_t intervalSec = res["polling_interval_seconds"];
    uint32_t newIntervalMs = intervalSec * 1000;

    // Validate interval is reasonable (30 sec to 5 min)
    if (newIntervalMs >= 30000 && newIntervalMs <= 300000) {
      if (newIntervalMs != pollIntervalMs) {
        pollIntervalMs = newIntervalMs;
        String msg = "Interval: " + String(intervalSec) + "s";
        showLines("Config updated", msg);
        delay(1000);
      }
    }
  }

  String relayCmd = String((const char*)res["relay"]);
  relayCmd.toUpperCase();
  if (relayCmd == "ON") {
    setRelay(true);
  } else if (relayCmd == "OFF") {
    setRelay(false);
  }
}

void showActiveDisplay(float voltage, float current, float power, float energy, bool tamper) {
  if (tamper) {
    showLines("TAMPER DETECTED", "Meter Opened", relayOn ? "Relay: ON" : "Relay: OFF");
    return;
  }

  showLines(
    "V:" + String(voltage, 2) + " I:" + String(current, 2),
    "P:" + String(power, 2) + "W",
    "Units:" + String(energy / 1000.0f, 4),
    relayOn ? "Relay: ON" : "Relay: OFF"
  );
}

void sampleSensorsAndUpdateDisplay() {
  unsigned long now = millis();
  float busVoltage = ina219.getBusVoltage_V();
  float currentA = ina219.getCurrent_mA() / 1000.0f;
  float powerW = ina219.getPower_mW() / 1000.0f;
  bool tamper = isTamperDetected();

  if (hasLiveSample && now >= lastSampleMs) {
    float elapsedHours = (now - lastSampleMs) / 3600000.0f;
    // Integrate energy using previous power over elapsed sampling time.
    totalEnergyWh += livePower * elapsedHours;
  }

  liveVoltage = busVoltage;
  liveCurrent = currentA;
  livePower = powerW;
  liveTamper = tamper;
  liveTimestamp = nowIso8601();
  hasLiveSample = true;
  lastSampleMs = now;

  showActiveDisplay(liveVoltage, liveCurrent, livePower, totalEnergyWh, liveTamper);
}

void readAndSendCycle() {
  if (!hasLiveSample) {
    sampleSensorsAndUpdateDisplay();
  }

  Reading r = {
    liveVoltage,
    liveCurrent,
    livePower,
    totalEnergyWh,
    liveTamper,
    liveTimestamp
  };

  flushBacklog();

  if (!sendReading(r, false)) {
    addBufferedReading(r.voltage, r.current, r.power, r.energy, r.tamper, r.timestamp);
  }

  pollRelayCommand();
}

void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(TAMPER_PIN, INPUT_PULLUP);
  pinMode(BOOT_BUTTON_PIN, INPUT_PULLUP);
  setRelay(true);

  Wire.begin(21, 22);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    // Continue without display.
  } else {
    showLines("Smart Energy Meter", "Initializing...");
  }

  if (!ina219.begin()) {
    showLines("INA219 error", "Check wiring");
  }

  prefs.begin("smartmeter", false);
  loadCredentials();

  deviceUid = WiFi.macAddress();

  if (!connectWifi()) {
    runWifiSetupPortal();
  }

  showLines("WiFi connected", WiFi.localIP().toString());

  syncNtp();

  if (!paired) {
    runPairingMode();
  }

  lastLoopMs = millis();
  lastDisplayMs = lastLoopMs;
  lastSampleMs = lastLoopMs;
  sampleSensorsAndUpdateDisplay();
}

void loop() {
  checkFactoryResetButton();

  if (WiFi.status() != WL_CONNECTED) {
    if (!connectWifi()) {
      delay(2000);
      return;
    }
  }

  if (!paired) {
    runPairingMode();
  }

  unsigned long now = millis();
  if (now - lastDisplayMs >= LIVE_REFRESH_INTERVAL_MS) {
    lastDisplayMs = now;
    sampleSensorsAndUpdateDisplay();
  }

  if (now - lastLoopMs >= pollIntervalMs) {
    lastLoopMs = now;
    readAndSendCycle();
  }

  delay(20);
}
