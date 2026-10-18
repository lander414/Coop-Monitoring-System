/*
 * Poultry Coop Environmental & Activity Telemetry Firmware
 * Target Board: ESP32 with Integrated SIM (e.g. TTGO T-Call SIM800L / SIM7600 / A7670) or ESP32 + GSM Module
 * 
 * Sensors:
 *  - PIR Motion Sensor (Passive Infrared) -> Detects flock movement / activity
 *  - DHT22 (AM2302) -> High-accuracy temperature and relative humidity
 * 
 * Communication:
 *  - Primary: Cellular GPRS / GSM via integrated SIM module (TinyGSM)
 *  - Fallback / Desk Testing: Optional Wi-Fi mode
 * 
 * Backend Endpoint:
 *  - POST /api/monitoring
 *  - Header: x-device-key: <DEVICE_INGEST_KEY>
 *  - Payload: { "device_id": "...", "temperature": 28.5, "humidity": 65.0, "chicken_present": true }
 */

// ==========================================
// 1. SELECT CONNECTION MODE & HARDWARE
// ==========================================
// Set to true if testing indoors with Wi-Fi, or false to use Cellular SIM (GPRS)
#define USE_WIFI_FALLBACK true

// If your board is LilyGO TTGO T-Call SIM800L (with IP5306 power IC), leave defined.
// If using another board (e.g. standard ESP32 + standalone SIM800L/A7670), comment this out.
#define BOARD_TTGO_TCALL_SIM800L 1

// Select your modem type for TinyGSM:
#define TINY_GSM_MODEM_SIM800
// Alternatives if you have 4G LTE versions:
// #define TINY_GSM_MODEM_SIM7600
// #define TINY_GSM_MODEM_A7670

// Increase TinyGSM rx buffer for stable HTTP handling
#define TINY_GSM_RX_BUFFER 650

// ==========================================
// 2. PIN ASSIGNMENTS
// ==========================================
// Sensor Pins:
// Choose GPIOs that don't conflict with SIM module UART or Boot pins
#define PIR_PIN          13   // PIR Motion Sensor OUT pin
#define DHT_PIN          21   // DHT22 DATA pin (with 10k pull-up resistor if non-module)
#define DHT_TYPE         DHT22

#if defined(BOARD_TTGO_TCALL_SIM800L)
  // TTGO T-Call v1.3 / v1.4 default pinout
  #define MODEM_RST             5
  #define MODEM_PWKEY           4
  #define MODEM_POWER_ON        23
  #define MODEM_TX              27
  #define MODEM_RX              26
  #define I2C_SDA               21
  #define I2C_SCL               22
  #define IP5306_ADDR           0x75
  #define IP5306_REG_SYS_CTL0   0x00
  // Note: On TTGO T-Call, I2C uses 21 and 22. If using TTGO T-Call, map DHT to GPIO 14 or 15!
  #undef DHT_PIN
  #define DHT_PIN               14
#else
  // Generic ESP32 + GSM module pinout (Serial2)
  #define MODEM_TX              17   // ESP32 TX -> SIM RX
  #define MODEM_RX              16   // ESP32 RX -> SIM TX
  #define MODEM_PWKEY           4    // Optional power-key pin (set -1 if hardwired)
  #define MODEM_RST             5    // Optional reset pin (set -1 if hardwired)
#endif

// ==========================================
// 3. CELLULAR & BACKEND CONFIGURATION
// ==========================================
// Cellular Carrier APN (Leave user/pass blank if not required by carrier)
// Examples:
//   Globe (Philippines): "internet.globe.com.ph"
//   Smart / TNT (PH):    "internet"
//   DITO (PH):           "internet.dito.ph"
//   Generic:             "your-apn-here"
const char apn[]      = "internet.globe.com.ph";
const char gprsUser[] = "";
const char gprsPass[] = "";

#include "coop_config.h"

// Backend Server settings (configured in coop_config.h):
const char* BACKEND_HOST = COOP_BACKEND_HOST;
const int   BACKEND_PORT = COOP_BACKEND_PORT;
const char* BACKEND_PATH = "/api/monitoring";

const char* DEVICE_ID        = SENSOR_NODE_DEVICE_ID;
const char* DEVICE_INGEST_KEY = COOP_DEVICE_INGEST_KEY;

// Wi-Fi credentials (configured in coop_config.h):
const char* WIFI_SSID = COOP_WIFI_SSID;
const char* WIFI_PASS = COOP_WIFI_PASSWORD;

// Interval between telemetry transmissions (configured in coop_config.h)
const unsigned long SEND_INTERVAL_MS = SENSOR_TELEMETRY_INTERVAL_MS;

// ==========================================
// 4. LIBRARIES & INSTANCES
// ==========================================
#include <Wire.h>
#include <DHT.h>

#if USE_WIFI_FALLBACK
  #include <WiFi.h>
  #include <HTTPClient.h>
#else
  #include <TinyGsmClient.h>
  #include <ArduinoHttpClient.h>
  
  HardwareSerial SerialAT(1); // Use UART1 for modem
  TinyGsm modem(SerialAT);
  TinyGsmClient client(modem);
  HttpClient http(client, BACKEND_HOST, BACKEND_PORT);
#endif

DHT dht(DHT_PIN, DHT_TYPE);

// Activity Monitoring Variables
volatile unsigned long motionPulseCount = 0;
unsigned long lastSendTime = 0;
unsigned long windowStartTime = 0;

// Interrupt Service Routine for PIR Motion Sensor
void IRAM_ATTR pirMotionISR() {
  motionPulseCount++;
}

// Power configuration for LilyGO TTGO T-Call (IP5306 I2C power management IC)
#if defined(BOARD_TTGO_TCALL_SIM800L)
bool setupIP5306() {
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.beginTransmission(IP5306_ADDR);
  Wire.write(IP5306_REG_SYS_CTL0);
  Wire.write(0x37); // Enable boost output, charging, fuel gauge, keep power on
  return (Wire.endTransmission() == 0);
}
#endif

// Power up the cellular modem (only needed for Cellular SIM mode)
#if !USE_WIFI_FALLBACK
void powerOnModem() {
#if defined(BOARD_TTGO_TCALL_SIM800L)
  setupIP5306();
  pinMode(MODEM_POWER_ON, OUTPUT);
  digitalWrite(MODEM_POWER_ON, HIGH);

  pinMode(MODEM_PWKEY, OUTPUT);
  digitalWrite(MODEM_PWKEY, LOW);
  delay(100);
  digitalWrite(MODEM_PWKEY, HIGH);
  delay(1000);
  digitalWrite(MODEM_PWKEY, LOW);
#else
  #if defined(MODEM_PWKEY) && MODEM_PWKEY >= 0
    pinMode(MODEM_PWKEY, OUTPUT);
    digitalWrite(MODEM_PWKEY, LOW);
    delay(100);
    digitalWrite(MODEM_PWKEY, HIGH);
    delay(1000);
    digitalWrite(MODEM_PWKEY, LOW);
  #endif
#endif
  delay(3000); // Allow modem to boot and stabilize
}
#endif

// Connect to Cellular Network
#if !USE_WIFI_FALLBACK
bool connectCellular() {
  Serial.println("[CELLULAR] Initializing modem...");
  SerialAT.begin(115200, SERIAL_8N1, MODEM_RX, MODEM_TX);
  delay(1000);

  powerOnModem();

  if (!modem.restart()) {
    Serial.println("[CELLULAR] Modem restart failed! Retrying init...");
    if (!modem.init()) {
      Serial.println("[CELLULAR] Modem init failed. Check wiring and power supply!");
      return false;
    }
  }

  String modemInfo = modem.getModemInfo();
  Serial.print("[CELLULAR] Modem Info: ");
  Serial.println(modemInfo);

  Serial.print("[CELLULAR] Waiting for network registration...");
  if (!modem.waitForNetwork(60000L)) {
    Serial.println(" FAILED!");
    return false;
  }
  Serial.println(" Registered!");

  Serial.print("[CELLULAR] Connecting to APN: ");
  Serial.println(apn);
  if (!modem.gprsConnect(apn, gprsUser, gprsPass)) {
    Serial.println("[CELLULAR] GPRS connection failed!");
    return false;
  }
  Serial.println("[CELLULAR] GPRS Connected successfully!");
  Serial.print("[CELLULAR] Local IP: ");
  Serial.println(modem.localIP());
  return true;
}
#endif

// Connect to Wi-Fi / Mobile Hotspot
#if USE_WIFI_FALLBACK
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("[WIFI] Connecting to SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 25) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected successfully!");
    Serial.print("[WIFI] ESP32 IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WIFI] Connection timed out. Will retry during next telemetry cycle.");
  }
}
#endif

void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial.println("\n=========================================");
  Serial.println("Poultry Coop Sensor Node (ESP32 + SIM)");
#if defined(BOARD_TTGO_TCALL_SIM800L)
  setupIP5306();
#endif

  // Initialize Sensors
  pinMode(PIR_PIN, INPUT);
  // Attach interrupt to count PIR pulses during the sampling window
  attachInterrupt(digitalPinToInterrupt(PIR_PIN), pirMotionISR, RISING);
  
  dht.begin();
  Serial.println("[SENSORS] DHT22 and PIR initialized.");

#if USE_WIFI_FALLBACK
  connectWiFi();
#else
  if (!connectCellular()) {
    Serial.println("[CELLULAR] Initial connection failed. Will retry during loop.");
  }
#endif

  windowStartTime = millis();
}

void loop() {
  unsigned long now = millis();

  // Send telemetry at configured interval
  if (now - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = now;

    // 1. Read DHT22
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();

    if (isnan(temperature) || isnan(humidity)) {
      Serial.println("[DHT22] Warning: Failed to read from DHT22! Retrying once...");
      delay(200);
      temperature = dht.readTemperature();
      humidity = dht.readHumidity();
    }

    if (isnan(temperature) || isnan(humidity)) {
      Serial.println("[DHT22] Error: Sensor read failure. Skipping payload.");
      return;
    }

    // 2. Evaluate PIR Chicken Activity
    // If PIR triggered at least once or is currently HIGH, activity is detected
    bool currentPinState = (digitalRead(PIR_PIN) == HIGH);
    bool chickenPresent = (motionPulseCount > 0 || currentPinState);

    Serial.println("\n--- [TELEMETRY SAMPLE] ---");
    Serial.print("Temperature: "); Serial.print(temperature, 1); Serial.println(" °C");
    Serial.print("Humidity:    "); Serial.print(humidity, 1); Serial.println(" %");
    Serial.print("PIR Pulses:  "); Serial.print(motionPulseCount);
    Serial.print(" | Active:  "); Serial.println(chickenPresent ? "YES (Chickens moving)" : "NO (Resting/Empty)");

    // Reset pulse counter for next sampling window
    motionPulseCount = 0;

    // 3. Build JSON Payload
    // Expected format: {"device_id":"...","temperature":28.5,"humidity":65.0,"chicken_present":true}
    String jsonPayload = "{";
    jsonPayload += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
    jsonPayload += "\"temperature\":" + String(temperature, 1) + ",";
    jsonPayload += "\"humidity\":" + String(humidity, 1) + ",";
    jsonPayload += "\"chicken_present\":" + String(chickenPresent ? "true" : "false");
    jsonPayload += "}";

    // 4. Transmit to Backend
    transmitPayload(jsonPayload);
  }
}

// Transmit telemetry payload to backend
void transmitPayload(const String& payload) {
#if USE_WIFI_FALLBACK
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  HTTPClient http;
  String url = "http://" + String(BACKEND_HOST) + ":" + String(BACKEND_PORT) + String(BACKEND_PATH);
  Serial.print("[HTTP-WIFI] Posting to: ");
  Serial.println(url);

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_INGEST_KEY);

  int httpCode = http.POST(payload);
  if (httpCode > 0) {
    Serial.printf("[HTTP-WIFI] Response Code: %d\n", httpCode);
    String response = http.getString();
    Serial.println("[HTTP-WIFI] Response: " + response);
  } else {
    Serial.printf("[HTTP-WIFI] POST failed, error: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();

#else
  // Cellular GPRS Transmission
  if (!modem.isGprsConnected()) {
    Serial.println("[CELLULAR] GPRS disconnected, reconnecting...");
    if (!modem.gprsConnect(apn, gprsUser, gprsPass)) {
      Serial.println("[CELLULAR] Reconnect failed!");
      return;
    }
  }

  Serial.print("[CELLULAR-HTTP] Posting to: ");
  Serial.print(BACKEND_HOST);
  Serial.println(BACKEND_PATH);

  http.beginRequest();
  http.post(BACKEND_PATH);
  http.sendHeader("Host", BACKEND_HOST);
  http.sendHeader("Content-Type", "application/json");
  http.sendHeader("x-device-key", DEVICE_INGEST_KEY);
  http.sendHeader("Content-Length", payload.length());
  http.beginBody();
  http.print(payload);
  http.endRequest();

  int statusCode = http.responseStatusCode();
  String responseBody = http.responseBody();

  Serial.print("[CELLULAR-HTTP] Status code: ");
  Serial.println(statusCode);
  Serial.print("[CELLULAR-HTTP] Response: ");
  Serial.println(responseBody);
#endif
}
