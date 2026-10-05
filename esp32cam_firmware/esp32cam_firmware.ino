#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <WiFiUdp.h>
#include <ESPmDNS.h>

// =========================
// Default / Fallback configuration
// =========================
const char* DEFAULT_WIFI_SSID = "Lander Agustin";
const char* DEFAULT_WIFI_PASSWORD = "dodoy414";
const char* DEFAULT_BACKEND_URL = "http://192.168.100.14:3000/api/devices/ESP32_CAM_01/frames";
const char* DEFAULT_DEVICE_INGEST_KEY = "c69d3b007c0243369f7a7613ed324e612dcd222c0e924f5c9325470597c80379";

const char* DEVICE_ID = "ESP32_CAM_01";
const char* FIRMWARE_VERSION = "esp32cam-autodiscovery-1.2";

// Captive Portal Hotspot configuration
const char* AP_SSID = "PoultryCam-Setup";
const char* AP_PASSWORD = "";  // Open network for setup
const byte DNS_PORT = 53;
const IPAddress AP_IP(192, 168, 4, 1);
const IPAddress AP_NETMASK(255, 255, 255, 0);

// UDP Auto-Discovery port
const unsigned int DISCOVERY_PORT = 5005;

// Dynamic settings (loaded from Preferences / NVS flash)
String wifiSsid = "";
String wifiPassword = "";
String backendUrl = "";
String deviceIngestKey = "";

const unsigned long CAPTURE_INTERVAL = 30000UL;
const bool ENABLE_AUTO_CAPTURE = true;
const bool ENABLE_AUTO_UPLOAD = true;
const bool ENABLE_STREAM_ENDPOINT = false;   // Keep disabled to stabilize memory on ESP32-CAM

// Camera settings
const framesize_t CAMERA_FRAME_SIZE_WITH_PSRAM = FRAMESIZE_XGA;
const framesize_t CAMERA_FRAME_SIZE_WITHOUT_PSRAM = FRAMESIZE_VGA;
const int CAMERA_JPEG_QUALITY_WITH_PSRAM = 10;
const int CAMERA_JPEG_QUALITY_WITHOUT_PSRAM = 12;

const unsigned long WIFI_RECONNECT_INTERVAL = 10000UL;
const unsigned long BACKEND_TIMEOUT = 15000UL;

// =========================
// AI-Thinker ESP32-CAM pins
// =========================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

enum DeviceMode {
  MODE_STA,
  MODE_AP
};

DeviceMode currentMode = MODE_STA;
WebServer server(80);
DNSServer dnsServer;
Preferences preferences;
WiFiUDP udp;

bool udpStarted = false;
bool cameraReady = false;
bool webServerStarted = false;
bool captureInProgress = false;
bool shouldReboot = false;
unsigned long rebootAtMillis = 0;

unsigned long lastCaptureMillis = 0;
unsigned long lastWifiAttemptMillis = 0;
unsigned int consecutiveWifiFailures = 0;
unsigned long captureSequence = 0;
size_t lastCaptureSize = 0;
String lastCaptureStatus = "No image captured yet";
String lastUploadStatus = "Automatic upload disabled";

unsigned long lastScanMillis = 0;
int cachedNetworkCount = -1;

// =========================
// Helper & Storage Functions
// =========================
bool isPlaceholder(const String& value) {
  return value.length() == 0 || value.indexOf("YOUR_") >= 0 || value.indexOf("replace-with") >= 0;
}

String extractJsonValue(const String& json, const String& key) {
  int keyIndex = json.indexOf("\"" + key + "\":");
  if (keyIndex == -1) return "";
  int valStart = json.indexOf("\"", keyIndex + key.length() + 3);
  if (valStart == -1) return "";
  int valEnd = json.indexOf("\"", valStart + 1);
  if (valEnd == -1) return "";
  return json.substring(valStart + 1, valEnd);
}

void loadConfiguration() {
  preferences.begin("poultry", true);
  wifiSsid = preferences.getString("ssid", DEFAULT_WIFI_SSID);
  wifiPassword = preferences.getString("pass", DEFAULT_WIFI_PASSWORD);
  backendUrl = preferences.getString("backend", DEFAULT_BACKEND_URL);
  deviceIngestKey = preferences.getString("key", DEFAULT_DEVICE_INGEST_KEY);
  preferences.end();

  Serial.println("[CONFIG] Loaded settings from flash:");
  Serial.printf("  SSID: %s\n", wifiSsid.length() > 0 ? wifiSsid.c_str() : "(not set)");
  Serial.printf("  Backend URL: %s\n", backendUrl.c_str());
  Serial.printf("  Ingest Key: %s\n", deviceIngestKey.length() > 0 ? "[configured]" : "(not set)");
}

void saveConfiguration(const String& ssid, const String& pass, const String& backend, const String& key) {
  preferences.begin("poultry", false);
  preferences.putString("ssid", ssid);
  preferences.putString("pass", pass);
  preferences.putString("backend", backend);
  preferences.putString("key", key);
  preferences.end();

  wifiSsid = ssid;
  wifiPassword = pass;
  backendUrl = backend;
  deviceIngestKey = key;
  Serial.println("[CONFIG] Settings saved to flash memory.");
}

void clearConfiguration() {
  preferences.begin("poultry", false);
  preferences.clear();
  preferences.end();
  Serial.println("[CONFIG] Flash memory wiped.");
}

void printBanner() {
  Serial.println();
  Serial.println("====================================");
  Serial.println("POULTRY ESP32-CAM (Auto-Discovery)");
  Serial.println("====================================");
}

// =========================
// UDP Auto-Discovery
// =========================
bool discoverBackendServer() {
  if (WiFi.status() != WL_CONNECTED) return false;

  if (!udpStarted) {
    udp.begin(DISCOVERY_PORT);
    udpStarted = true;
  }

  Serial.println("[DISCOVERY] Broadcasting for Poultry Backend on port 5005...");
  const char* requestMsg = "POULTRY_DISCOVER_REQUEST";
  udp.beginPacket(IPAddress(255, 255, 255, 255), DISCOVERY_PORT);
  udp.write((const uint8_t*)requestMsg, strlen(requestMsg));
  udp.endPacket();

  unsigned long start = millis();
  char packetBuffer[512];
  while (millis() - start < 1500UL) {
    int packetSize = udp.parsePacket();
    if (packetSize > 0) {
      int len = udp.read(packetBuffer, sizeof(packetBuffer) - 1);
      if (len > 0) {
        packetBuffer[len] = '\0';
        String response = String(packetBuffer);
        Serial.println("[DISCOVERY] Response received: " + response);
        String discoveredUrl = extractJsonValue(response, "url");
        if (discoveredUrl.length() > 0 && discoveredUrl.startsWith("http://")) {
          Serial.println("[DISCOVERY] Auto-discovered backend!");
          Serial.println("[DISCOVERY] URL: " + discoveredUrl);
          if (discoveredUrl != backendUrl) {
            backendUrl = discoveredUrl;
            preferences.begin("poultry", false);
            preferences.putString("backend", backendUrl);
            preferences.end();
            Serial.println("[DISCOVERY] Updated backend URL saved to flash.");
          }
          return true;
        }
      }
    }
    delay(20);
  }

  Serial.println("[DISCOVERY] No backend response received (will retry automatically).");
  return false;
}

void checkIncomingDiscovery() {
  if (!udpStarted) return;
  int packetSize = udp.parsePacket();
  if (packetSize > 0) {
    char packetBuffer[512];
    int len = udp.read(packetBuffer, sizeof(packetBuffer) - 1);
    if (len > 0) {
      packetBuffer[len] = '\0';
      String response = String(packetBuffer);
      String discoveredUrl = extractJsonValue(response, "url");
      if (discoveredUrl.length() > 0 && discoveredUrl.startsWith("http://") && discoveredUrl != backendUrl) {
        Serial.println("[DISCOVERY] Backend announcement received! Updated URL: " + discoveredUrl);
        backendUrl = discoveredUrl;
        preferences.begin("poultry", false);
        preferences.putString("backend", backendUrl);
        preferences.end();
      }
    }
  }
}

// =========================
// Wi-Fi Connection
// =========================
bool connectToWiFi() {
  if (isPlaceholder(wifiSsid)) {
    Serial.println("[WIFI] No valid SSID configured.");
    return false;
  }

  Serial.print("[WIFI] Connecting to: ");
  Serial.println(wifiSsid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());

  unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < 20000UL) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WIFI] Connection failed.");
    return false;
  }

  WiFi.setSleep(false);
  Serial.println("[WIFI] Connected successfully!");
  Serial.print("[WIFI] IP Address: ");
  Serial.println(WiFi.localIP());
  consecutiveWifiFailures = 0;
  return true;
}

void maintainWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    consecutiveWifiFailures = 0;
    return;
  }

  unsigned long now = millis();
  if (now - lastWifiAttemptMillis < WIFI_RECONNECT_INTERVAL) return;

  lastWifiAttemptMillis = now;
  consecutiveWifiFailures++;
  Serial.printf("[WIFI] Connection lost. Retry #%u...\n", consecutiveWifiFailures);

  if (consecutiveWifiFailures >= 6) {
    Serial.println("[WIFI] Multiple connection failures. Switching to AP Setup mode...");
    startSetupAP();
    return;
  }

  WiFi.disconnect();
  WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());
}

// =========================
// Camera Driver
// =========================
bool initializeCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    config.frame_size = CAMERA_FRAME_SIZE_WITH_PSRAM;
    config.jpeg_quality = CAMERA_JPEG_QUALITY_WITH_PSRAM;
    config.fb_count = 2;
    config.grab_mode = CAMERA_GRAB_LATEST;
    Serial.println("[CAMERA] PSRAM detected: using XGA still images.");
  } else {
    config.frame_size = CAMERA_FRAME_SIZE_WITHOUT_PSRAM;
    config.jpeg_quality = CAMERA_JPEG_QUALITY_WITHOUT_PSRAM;
    config.fb_count = 1;
    config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
    Serial.println("[CAMERA] PSRAM not detected: using VGA still images.");
  }

  esp_err_t result = esp_camera_init(&config);
  if (result != ESP_OK) {
    Serial.printf("[CAMERA] Initialization failed with error 0x%x\n", result);
    return false;
  }

  sensor_t* sensor = esp_camera_sensor_get();
  if (sensor != nullptr) {
    sensor->set_brightness(sensor, 0);
    sensor->set_saturation(sensor, 0);
  }

  Serial.println("[CAMERA] Initialized successfully.");
  return true;
}

camera_fb_t* captureImage() {
  if (!cameraReady || captureInProgress) return nullptr;

  captureInProgress = true;
  Serial.println("[CAMERA] Capturing image...");
  camera_fb_t* frame = esp_camera_fb_get();

  if (frame == nullptr) {
    lastCaptureStatus = "Capture failed";
    lastCaptureSize = 0;
    Serial.println("[CAMERA] Image capture failed.");
    captureInProgress = false;
    return nullptr;
  }

  lastCaptureSize = frame->len;
  lastCaptureStatus = "Image captured";
  Serial.println("[CAMERA] Image captured");
  Serial.printf("[CAMERA] Size: %u bytes\n", static_cast<unsigned int>(frame->len));
  return frame;
}

void releaseImage(camera_fb_t* frame) {
  if (frame != nullptr) esp_camera_fb_return(frame);
  captureInProgress = false;
}

bool writeImageToClient(WiFiClient& client, const uint8_t* buffer, size_t length) {
  size_t bytesSent = 0;
  unsigned long startedAt = millis();

  while (bytesSent < length) {
    if (!client.connected() || millis() - startedAt > BACKEND_TIMEOUT) return false;

    size_t chunkSize = min(static_cast<size_t>(1460), length - bytesSent);
    size_t written = client.write(buffer + bytesSent, chunkSize);
    if (written == 0) {
      delay(2);
      continue;
    }
    bytesSent += written;
  }

  return true;
}

// =========================
// Backend Frame Upload
// =========================
bool sendImageToBackend(camera_fb_t* frame, unsigned long sequenceId) {
  if (frame == nullptr) return false;
  if (WiFi.status() != WL_CONNECTED) {
    lastUploadStatus = "Upload skipped: Wi-Fi disconnected";
    Serial.println("[BACKEND] Upload skipped because Wi-Fi is disconnected.");
    return false;
  }
  if (isPlaceholder(backendUrl) || isPlaceholder(deviceIngestKey)) {
    lastUploadStatus = "Upload not configured";
    Serial.println("[BACKEND] Set backend URL and ingest key first.");
    return false;
  }

  WiFiClient client;
  String parsedUrl = backendUrl;
  if (!parsedUrl.startsWith("http://")) {
    lastUploadStatus = "Only HTTP backend URLs are supported";
    Serial.println("[BACKEND] backendUrl must start with http://");
    return false;
  }

  parsedUrl.remove(0, 7);
  int pathStart = parsedUrl.indexOf('/');
  String hostPort = pathStart >= 0 ? parsedUrl.substring(0, pathStart) : parsedUrl;
  String requestPath = pathStart >= 0 ? parsedUrl.substring(pathStart) : "/";
  int port = 80;
  int portSeparator = hostPort.indexOf(':');
  if (portSeparator >= 0) {
    port = hostPort.substring(portSeparator + 1).toInt();
    hostPort = hostPort.substring(0, portSeparator);
  }

  const String boundary = "----ESP32CAMBoundary7MA4YWxkTrZu0gW";
  const String contentType = "multipart/form-data; boundary=" + boundary;
  const String fileHeader = "--" + boundary + "\r\n"
    "Content-Disposition: form-data; name=\"image\"; filename=\"capture.jpg\"\r\n"
    "Content-Type: image/jpeg\r\n\r\n";
  const String metadata = "\r\n--" + boundary + "\r\n"
    "Content-Disposition: form-data; name=\"sequence_id\"\r\n\r\n" + String(sequenceId) + "\r\n"
    "--" + boundary + "\r\n"
    "Content-Disposition: form-data; name=\"firmware_version\"\r\n\r\n" + FIRMWARE_VERSION + "\r\n"
    "--" + boundary + "--\r\n";
  const size_t contentLength = fileHeader.length() + frame->len + metadata.length();

  Serial.println("[BACKEND] Uploading image...");
  client.setTimeout(BACKEND_TIMEOUT);
  if (!client.connect(hostPort.c_str(), port)) {
    lastUploadStatus = "Backend connection setup failed";
    Serial.println("[BACKEND] Could not connect to backend. Triggering auto-discovery...");
    discoverBackendServer();
    return false;
  }

  client.printf("POST %s HTTP/1.1\r\n", requestPath.c_str());
  client.printf("Host: %s\r\n", hostPort.c_str());
  client.println("Connection: close");
  client.printf("Content-Type: %s\r\n", contentType.c_str());
  client.printf("Content-Length: %u\r\n", static_cast<unsigned int>(contentLength));
  client.printf("x-device-key: %s\r\n\r\n", deviceIngestKey.c_str());
  client.print(fileHeader);
  if (!writeImageToClient(client, frame->buf, frame->len)) {
    Serial.println("[BACKEND] Image upload interrupted while sending JPEG.");
    client.stop();
    lastUploadStatus = "Upload interrupted";
    return false;
  }
  client.print(metadata);

  unsigned long responseStartedAt = millis();
  while (!client.available() && client.connected() && millis() - responseStartedAt < BACKEND_TIMEOUT) {
    delay(10);
  }

  int responseCode = -1;
  String statusLine = client.readStringUntil('\n');
  if (statusLine.startsWith("HTTP/1.1") || statusLine.startsWith("HTTP/1.0")) {
    responseCode = statusLine.substring(9, 12).toInt();
  }
  while (client.connected()) {
    String line = client.readStringUntil('\n');
    if (line == "\r" || line.length() == 0) break;
  }
  String response = client.readString();
  Serial.printf("[BACKEND] HTTP status: %d\n", responseCode);
  if (response.length() > 0) Serial.println(response);
  client.stop();

  bool success = responseCode >= 200 && responseCode < 300;
  lastUploadStatus = success ? "Upload accepted" : "Upload failed";
  return success;
}

// =========================
// Web Portal & Handlers
// =========================

void handleRoot() {
  if (currentMode == MODE_AP) {
    handleSetupPortal();
    return;
  }

  String html;
  html.reserve(2400);
  html += "<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<title>Poultry ESP32-CAM</title>";
  html += "<style>"
          "body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#f8fafc;margin:0;padding:24px;display:flex;justify-content:center;}"
          ".card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;max-width:480px;width:100%;box-shadow:0 10px 25px rgba(0,0,0,0.5);}"
          "h1{font-size:20px;margin-top:0;color:#38bdf8;display:flex;align-items:center;gap:8px;}"
          ".row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #334155;font-size:14px;}"
          ".label{color:#94a3b8;}.val{font-weight:600;}"
          ".badge{background:#10b981;color:#fff;padding:2px 8px;border-radius:99px;font-size:12px;}"
          ".badge-off{background:#ef4444;}"
          ".actions{margin-top:20px;display:flex;flex-direction:column;gap:10px;}"
          ".btn{display:block;text-align:center;padding:10px;border-radius:8px;font-weight:600;text-decoration:none;font-size:14px;transition:0.2s;}"
          ".btn-primary{background:#2563eb;color:#fff;}"
          ".btn-primary:hover{background:#1d4ed8;}"
          ".btn-config{background:#0284c7;color:#fff;}"
          ".btn-config:hover{background:#0369a1;}"
          "</style></head><body><div class='card'>";

  html += "<h1>Poultry ESP32-CAM</h1>";
  html += "<div class='row'><span class='label'>Status:</span><span class='val'><span class='badge'>";
  html += WiFi.status() == WL_CONNECTED ? "Connected" : "Offline";
  html += "</span></span></div>";

  html += "<div class='row'><span class='label'>Network:</span><span class='val'>" + wifiSsid + "</span></div>";
  html += "<div class='row'><span class='label'>IP Address:</span><span class='val'>" + WiFi.localIP().toString() + "</span></div>";
  html += "<div class='row'><span class='label'>mDNS Host:</span><span class='val'>http://poultrycam.local</span></div>";
  html += "<div class='row'><span class='label'>Backend URL:</span><span class='val' style='word-break:break-all;font-size:12px;'>" + backendUrl + "</span></div>";
  html += "<div class='row'><span class='label'>Camera:</span><span class='val'>" + String(cameraReady ? "Ready" : "Unavailable") + "</span></div>";
  html += "<div class='row'><span class='label'>Last Capture:</span><span class='val'>" + lastCaptureStatus + " (" + String(lastCaptureSize) + " B)</span></div>";
  html += "<div class='row'><span class='label'>Last Upload:</span><span class='val'>" + lastUploadStatus + "</span></div>";

  html += "<div class='actions'>";
  html += "<a href='/capture' class='btn btn-primary'>Capture Single JPEG</a>";
  if (ENABLE_STREAM_ENDPOINT) html += "<a href='/stream' class='btn btn-primary'>Open Live Stream</a>";
  html += "<a href='/setup' class='btn btn-config'>Configure Wi-Fi & Backend Settings</a>";
  html += "</div></div></body></html>";

  server.send(200, "text/html", html);
}

void handleSetupPortal() {
  if (cachedNetworkCount < 0 || millis() - lastScanMillis > 20000UL) {
    Serial.println("[PORTAL] Scanning networks for portal UI...");
    cachedNetworkCount = WiFi.scanNetworks();
    lastScanMillis = millis();
    Serial.printf("[PORTAL] Found %d networks.\n", cachedNetworkCount);
  }
  int n = cachedNetworkCount;

  String html;
  html.reserve(4000);
  html += "<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<title>Poultry Cam Setup</title>";
  html += "<style>"
          "body{font-family:system-ui,-apple-system,sans-serif;background:#0b1329;color:#e2e8f0;margin:0;padding:20px;display:flex;justify-content:center;}"
          ".container{max-width:460px;width:100%;background:#1e293b;border:1px solid #334155;border-radius:14px;padding:24px;box-shadow:0 12px 30px rgba(0,0,0,0.5);}"
          "h2{margin:0 0 6px 0;font-size:22px;color:#38bdf8;}"
          "p.sub{color:#94a3b8;font-size:13px;margin:0 0 20px 0;}"
          ".status-box{background:#0f172a;border-left:4px solid #10b981;padding:10px 14px;border-radius:6px;font-size:13px;margin-bottom:20px;}"
          ".form-group{margin-bottom:16px;text-align:left;}"
          "label{display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:#cbd5e1;}"
          "input,select{width:100%;padding:10px 12px;box-sizing:border-box;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#fff;font-size:14px;}"
          "input:focus,select:focus{border-color:#38bdf8;outline:none;box-shadow:0 0 0 2px rgba(56,189,248,0.2);}"
          "button{width:100%;padding:12px;border:none;border-radius:8px;font-weight:700;font-size:15px;cursor:pointer;transition:0.2s;}"
          ".btn-save{background:linear-gradient(135deg,#10b981,#059669);color:#fff;margin-top:10px;}"
          ".btn-save:hover{filter:brightness(1.1);}"
          ".btn-clear{background:#dc2626;color:#fff;margin-top:10px;}"
          ".btn-back{background:#334155;color:#e2e8f0;margin-top:8px;display:block;text-align:center;text-decoration:none;padding:10px;border-radius:8px;font-size:13px;}"
          ".note{font-size:11px;color:#64748b;margin-top:4px;}"
          "</style>"
          "<script>"
          "function onSelectChange(val){"
          "  var manualInput = document.getElementById('manual_ssid');"
          "  if(val === '__manual__'){ manualInput.style.display = 'block'; manualInput.focus(); }"
          "  else { manualInput.style.display = 'none'; }"
          "}"
          "</script></head><body><div class='container'>";

  html += "<h2>Poultry Cam Setup</h2>";
  html += "<p class='sub'>Configure device Wi-Fi connection and backend URL.</p>";

  html += "<div class='status-box'>";
  if (currentMode == MODE_AP) {
    html += "Mode: <b>Hotspot Setup (AP)</b><br>SSID: <code>" + String(AP_SSID) + "</code>";
  } else {
    html += "Mode: <b>Connected (STA)</b><br>Current IP: <code>" + WiFi.localIP().toString() + "</code><br>Host: <code>http://poultrycam.local</code>";
  }
  html += "</div>";

  html += "<form method='POST' action='/save'>";

  // Wi-Fi SSID Selection
  html += "<div class='form-group'><label for='ssid'>Select Wi-Fi Network (2.4GHz):</label>";
  html += "<select name='ssid' id='ssid' onchange='onSelectChange(this.value)'>";

  bool currentFound = false;
  if (n <= 0) {
    html += "<option value='__manual__'>No networks found - Enter manually</option>";
  } else {
    for (int i = 0; i < n; ++i) {
      String foundSSID = WiFi.SSID(i);
      int rssi = WiFi.RSSI(i);
      String selected = (foundSSID == wifiSsid) ? " selected" : "";
      if (foundSSID == wifiSsid) currentFound = true;
      html += "<option value='" + foundSSID + "'" + selected + ">" + foundSSID + " (" + String(rssi) + " dBm)" + (WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? " [Open]" : "") + "</option>";
    }
    html += "<option value='__manual__'>-- Enter hidden / manual SSID --</option>";
  }
  html += "</select>";

  String manualDisplay = (n <= 0 || !currentFound) ? "block" : "none";
  html += "<input type='text' id='manual_ssid' name='manual_ssid' placeholder='Enter Wi-Fi SSID manually' value='" + (currentFound ? "" : wifiSsid) + "' style='margin-top:8px;display:" + manualDisplay + ";'>";
  html += "</div>";

  // Wi-Fi Password
  html += "<div class='form-group'><label for='password'>Wi-Fi Password:</label>";
  html += "<input type='password' id='password' name='password' value='" + wifiPassword + "' placeholder='Enter Wi-Fi password'>";
  html += "<div class='note'>Leave blank if the selected Wi-Fi network has no password.</div>";
  html += "</div>";

  // Backend Ingest URL
  html += "<div class='form-group'><label for='backend_url'>Backend Ingest URL (Auto-discovered via UDP):</label>";
  html += "<input type='text' id='backend_url' name='backend_url' value='" + backendUrl + "' placeholder='http://192.168.1.100:3000/api/devices/ESP32_CAM_01/frames'>";
  html += "<div class='note'>Auto-updated over Wi-Fi when your poultry backend is running.</div>";
  html += "</div>";

  // Device Ingest Key
  html += "<div class='form-group'><label for='device_key'>Device Ingest Key:</label>";
  html += "<input type='text' id='device_key' name='device_key' value='" + deviceIngestKey + "' placeholder='Secret device key'>";
  html += "</div>";

  html += "<button type='submit' class='btn-save'>Save & Connect</button>";
  html += "</form>";

  html += "<form method='POST' action='/clear' onsubmit='return confirm(\"Wipe saved Wi-Fi and reboot into setup mode?\")'>";
  html += "<button type='submit' class='btn-clear'>Reset to Factory Defaults</button>";
  html += "</form>";

  if (currentMode == MODE_STA) {
    html += "<a href='/' class='btn-back'>&larr; Back to Device Status</a>";
  }

  html += "</div></body></html>";
  server.send(200, "text/html", html);
}

void handleSaveConfig() {
  String selectedSsid = server.arg("ssid");
  String manualSsid = server.arg("manual_ssid");
  String newSsid = (selectedSsid == "__manual__" || selectedSsid.length() == 0) ? manualSsid : selectedSsid;
  newSsid.trim();

  String newPass = server.arg("password");
  newPass.trim();

  String newBackend = server.arg("backend_url");
  newBackend.trim();

  String newKey = server.arg("device_key");
  newKey.trim();

  if (newSsid.length() == 0) {
    server.send(400, "text/html", "<h3>Error: Wi-Fi SSID cannot be empty.</h3><p><a href='/setup'>Go back</a></p>");
    return;
  }

  saveConfiguration(newSsid, newPass, newBackend, newKey);

  String html = "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<title>Configuration Saved</title>";
  html += "<style>body{font-family:system-ui;background:#0f172a;color:#f8fafc;padding:30px;text-align:center;}"
          ".card{max-width:440px;margin:auto;background:#1e293b;padding:30px;border-radius:12px;border:1px solid #334155;}"
          "h2{color:#10b981;margin-top:0;}p{color:#cbd5e1;font-size:14px;line-height:1.5;}"
          "code{background:#0f172a;padding:3px 6px;border-radius:4px;color:#38bdf8;}"
          "</style></head><body><div class='card'>";
  html += "<h2>Configuration Saved!</h2>";
  html += "<p>The camera is restarting now to connect to <code>" + newSsid + "</code>.</p>";
  html += "<p>You can access it anytime at: <code>http://poultrycam.local</code></p>";
  html += "</div></body></html>";

  server.send(200, "text/html", html);

  shouldReboot = true;
  rebootAtMillis = millis() + 2500;
}

void handleClearConfig() {
  clearConfiguration();

  String html = "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<title>Cleared</title>";
  html += "<style>body{font-family:system-ui;background:#0f172a;color:#f8fafc;padding:30px;text-align:center;}"
          ".card{max-width:440px;margin:auto;background:#1e293b;padding:30px;border-radius:12px;border:1px solid #334155;}"
          "h2{color:#ef4444;margin-top:0;}</style></head><body><div class='card'>";
  html += "<h2>Defaults Cleared</h2>";
  html += "<p>Saved settings wiped. The camera is rebooting into AP Setup mode...</p>";
  html += "</div></body></html>";

  server.send(200, "text/html", html);

  shouldReboot = true;
  rebootAtMillis = millis() + 2000;
}

void handleCapture() {
  camera_fb_t* frame = captureImage();
  if (frame == nullptr) {
    server.send(503, "text/plain", "Camera capture failed");
    return;
  }

  WiFiClient client = server.client();
  client.printf(
    "HTTP/1.1 200 OK\r\n"
    "Content-Type: image/jpeg\r\n"
    "Content-Length: %u\r\n"
    "Content-Disposition: inline; filename=capture.jpg\r\n"
    "Connection: close\r\n\r\n",
    static_cast<unsigned int>(frame->len)
  );
  bool imageSent = writeImageToClient(client, frame->buf, frame->len);
  client.flush();
  releaseImage(frame);

  if (!imageSent) {
    client.stop();
  }
}

void handleStream() {
  if (!ENABLE_STREAM_ENDPOINT) {
    server.send(404, "text/plain", "Stream disabled");
    return;
  }

  WiFiClient client = server.client();
  client.print("HTTP/1.1 200 OK\r\nContent-Type: multipart/x-mixed-replace; boundary=frame\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n");

  for (int frameNumber = 0; frameNumber < 60 && client.connected(); frameNumber++) {
    camera_fb_t* frame = captureImage();
    if (frame == nullptr) break;
    client.printf("--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n", static_cast<unsigned int>(frame->len));
    if (!writeImageToClient(client, frame->buf, frame->len)) {
      releaseImage(frame);
      break;
    }
    client.print("\r\n");
    releaseImage(frame);
    delay(150);
  }
}

void handleNotFound() {
  if (currentMode == MODE_AP) {
    server.sendHeader("Location", "http://192.168.4.1/setup", true);
    server.send(302, "text/plain", "");
    return;
  }
  server.send(404, "text/plain", "Not Found");
}

void registerServerRoutes() {
  server.on("/", HTTP_GET, handleRoot);
  server.on("/setup", HTTP_GET, handleSetupPortal);
  server.on("/save", HTTP_POST, handleSaveConfig);
  server.on("/clear", HTTP_POST, handleClearConfig);
  server.on("/capture", HTTP_GET, handleCapture);
  if (ENABLE_STREAM_ENDPOINT) server.on("/stream", HTTP_GET, handleStream);

  server.on("/generate_204", HTTP_GET, []() {
    server.sendHeader("Location", "http://192.168.4.1/setup", true);
    server.send(302, "text/plain", "");
  });
  server.on("/hotspot-detect.html", HTTP_GET, []() {
    server.sendHeader("Location", "http://192.168.4.1/setup", true);
    server.send(302, "text/plain", "");
  });
  server.on("/canonical.html", HTTP_GET, []() {
    server.sendHeader("Location", "http://192.168.4.1/setup", true);
    server.send(302, "text/plain", "");
  });
  server.on("/ncsi.txt", HTTP_GET, []() {
    server.sendHeader("Location", "http://192.168.4.1/setup", true);
    server.send(302, "text/plain", "");
  });
  server.on("/connecttest.txt", HTTP_GET, []() {
    server.sendHeader("Location", "http://192.168.4.1/setup", true);
    server.send(302, "text/plain", "");
  });

  server.onNotFound(handleNotFound);
}

void startSetupAP() {
  currentMode = MODE_AP;
  udpStarted = false;
  WiFi.disconnect();
  delay(100);

  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(AP_IP, AP_IP, AP_NETMASK);
  WiFi.softAP(AP_SSID, AP_PASSWORD);

  dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
  dnsServer.start(DNS_PORT, "*", AP_IP);

  if (!webServerStarted) {
    registerServerRoutes();
    server.begin();
    webServerStarted = true;
  }

  Serial.println();
  Serial.println("==================================================");
  Serial.println("[AP MODE] Setup Hotspot Active!");
  Serial.printf("  SSID: %s\n", AP_SSID);
  Serial.println("  IP:   192.168.4.1");
  Serial.println("  Connect to this Wi-Fi from your phone or PC.");
  Serial.println("  Browse to: http://192.168.4.1/setup");
  Serial.println("==================================================");
  Serial.println();
}

void startStationServer() {
  if (!MDNS.begin("poultrycam")) {
    Serial.println("[MDNS] Error setting up MDNS responder!");
  } else {
    Serial.println("[MDNS] Hostname active: http://poultrycam.local");
    MDNS.addService("http", "tcp", 80);
  }

  if (!webServerStarted) {
    registerServerRoutes();
    server.begin();
    webServerStarted = true;
  }
  Serial.println("[SERVER] Camera web server started.");
  Serial.print("[SERVER] Status URL: http://");
  Serial.println(WiFi.localIP());
  Serial.print("[SERVER] Setup URL:  http://");
  Serial.print(WiFi.localIP());
  Serial.println("/setup");
  Serial.println("[SERVER] Local name: http://poultrycam.local");

  // Broadcast UDP to find the poultry backend automatically
  discoverBackendServer();
}

void runAutomaticCapture() {
  if (!ENABLE_AUTO_CAPTURE || captureInProgress) return;
  if (millis() - lastCaptureMillis < CAPTURE_INTERVAL) return;

  lastCaptureMillis = millis();
  captureSequence++;
  camera_fb_t* frame = captureImage();
  if (frame == nullptr) return;

  if (ENABLE_AUTO_UPLOAD) {
    sendImageToBackend(frame, captureSequence);
  }
  releaseImage(frame);
}

// =========================
// Setup & Loop
// =========================
void setup() {
  Serial.begin(115200);
  delay(1000);
  printBanner();

  loadConfiguration();

  Serial.println("Initializing camera hardware...");
  cameraReady = initializeCamera();
  if (!cameraReady) {
    Serial.println("[CAMERA] Hardware warning: Check board selection, ribbon cable, or power.");
  }

  Serial.println("Attempting Wi-Fi connection...");
  bool connected = connectToWiFi();

  if (connected) {
    currentMode = MODE_STA;
    startStationServer();
  } else {
    Serial.println("[WIFI] Could not connect to saved Wi-Fi. Launching Setup Hotspot...");
    startSetupAP();
  }
}

void loop() {
  if (shouldReboot && millis() >= rebootAtMillis) {
    Serial.println("[SYSTEM] Restarting ESP32...");
    delay(100);
    ESP.restart();
  }

  if (currentMode == MODE_AP) {
    dnsServer.processNextRequest();
    server.handleClient();
  } else {
    maintainWiFi();
    if (WiFi.status() == WL_CONNECTED) {
      checkIncomingDiscovery();
      server.handleClient();
      if (cameraReady) {
        runAutomaticCapture();
      }
    }
  }

  delay(2);
}