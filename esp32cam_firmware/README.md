# AI-Thinker ESP32-CAM Firmware (Static Wi-Fi Configuration)

Open `esp32cam_firmware.ino` in Arduino IDE. This firmware captures JPEG still images, hosts a lightweight local web interface, and uploads images to the Poultry Monitoring Node.js backend.

Wi-Fi credentials, backend endpoint, and ingest keys are configured statically at the top of `esp32cam_firmware.ino`.

---

## Configuration

Edit the configuration constants at the top of [esp32cam_firmware.ino](file:///c:/Users/razel/Documents/GitHub/Coop-Monitoring-System/esp32cam_firmware/esp32cam_firmware.ino):

```cpp
// =========================
// Static Wi-Fi & Backend Configuration
// =========================
const char* WIFI_SSID = "Lander Agustin";
const char* WIFI_PASSWORD = "dodoy414";

// Optional: Static IP configuration
// Set USE_STATIC_IP to true if you want a fixed IP instead of DHCP
const bool USE_STATIC_IP = false;
const IPAddress STATIC_IP(192, 168, 100, 50);
const IPAddress GATEWAY_IP(192, 168, 100, 1);
const IPAddress SUBNET_MASK(255, 255, 255, 0);
const IPAddress DNS_IP(192, 168, 100, 1);

// Backend ingestion settings
const char* DEFAULT_BACKEND_URL = "http://192.168.100.14:3000/api/devices/ESP32_CAM_01/frames";
const char* DEVICE_INGEST_KEY = "c69d3b007c0243369f7a7613ed324e612dcd222c0e924f5c9325470597c80379";
```

---

## Arduino IDE Setup

1. Install the Espressif ESP32 board package through **Boards Manager**.
2. Select **AI Thinker ESP32-CAM** under `Tools > Board > esp32`.
3. Select the correct COM port for the ESP32-CAM-MB.
4. Recommended settings:
   - Upload Speed: `115200`
   - CPU Frequency: `240MHz (WiFi/BT)`
   - Flash Frequency: `80MHz`
   - Partition Scheme: `Huge APP (3MB No OTA/1MB SPIFFS)` or default scheme
   - PSRAM: `Enabled` when available
5. Open `Tools > Serial Monitor` at `115200` baud.

The sketch uses only standard libraries included with the ESP32 Arduino core:
- `esp_camera.h`
- `WiFi.h`
- `WebServer.h`
- `WiFiUdp.h`
- `ESPmDNS.h`

---

## Automatic Backend Discovery (Optional)

Even with static Wi-Fi configuration, the firmware supports UDP auto-discovery:
- When the ESP32 connects to Wi-Fi, it broadcasts a UDP packet on port `5005`.
- If `poultry-backend` is running on the local network, it will respond with its actual LAN IP address and update the ingest URL dynamically in memory.
- If UDP discovery is not available, it simply falls back to `DEFAULT_BACKEND_URL`.

---

## Accessing the Camera Web Interface

When connected to your local network, you can access the camera:
- Via mDNS:
  ```text
  http://poultrycam.local
  ```
- Or via the assigned IP address printed in the Serial Monitor (e.g. `http://192.168.100.50` or router DHCP IP).

Endpoints:
- `/` - Status dashboard (connection info, last capture and upload status)
- `/capture` - Manual capture and JPEG download

---

## Wiring and Upload

1. Insert the ESP32-CAM into the ESP32-CAM-MB.
2. Connect the MB board to USB.
3. Put the board into download mode (hold `BOOT`/`IO0` or press MB switch depending on revision).
4. Upload the sketch from Arduino IDE.
5. Disconnect GPIO0 from GND (or return switch to run mode).
6. Press the reset button on the ESP32-CAM.

---

## Troubleshooting

- **Wi-Fi Connection Fails**: Make sure your Wi-Fi is **2.4GHz**. The ESP32 does not support 5GHz bands. Check SSID and password spelling.
- **ESP32-CAM Brownout / Reset Loop**: ESP32-CAM draws high peak current when initializing Wi-Fi and the camera sensor. Use a quality USB cable and a reliable 5V power supply (at least 2A).
- **Backend Upload Issues**: Ensure the backend server is running and reachable from the same local network subnet.