# AI-Thinker ESP32-CAM Firmware (Dynamic Wi-Fi Portal)

Open `esp32cam_firmware.ino` in Arduino IDE. This firmware captures JPEG still images, hosts a local test page, and can upload images to the Node.js backend.

**No hardcoding needed!** You can configure Wi-Fi and backend credentials directly from your phone or PC browser using the built-in Setup Hotspot & Captive Portal.

---

## Arduino IDE setup

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
- `DNSServer.h`
- `Preferences.h`

---

## How to Configure Wi-Fi via Web Portal (Method 1)

### First-Time Setup or New Wi-Fi Network
1. Power on the ESP32-CAM.
2. If it has no saved Wi-Fi or cannot connect to the previous network, it automatically launches its own setup hotspot:
   - **Wi-Fi SSID**: `PoultryCam-Setup`
   - **Password**: *(None - open network)*
   - **IP Address**: `192.168.4.1`
3. On your phone, tablet, or laptop, connect your Wi-Fi to **`PoultryCam-Setup`**.
4. A captive portal screen will pop up automatically. If it doesn't, simply open your browser and navigate to:
   ```text
   http://192.168.4.1
   ```
5. The portal will display:
   - **Nearby Wi-Fi Networks (2.4GHz)**: Pick your router/hotspot SSID from the dropdown.
   - **Wi-Fi Password**: Enter your network password.
   - **Backend Ingest URL**: Pre-filled with automatic discovery or default LAN address.
   - **Device Ingest Key**: Your backend's configured secret key.
6. Click **Save & Connect**.
7. The ESP32-CAM will save your settings permanently into non-volatile flash memory (`Preferences`), reboot, and automatically connect to your router.

---

## UDP Auto-Discovery (Zero IP Input Needed)

You do **not** need to manually look up or configure your computer's IP address:
- When the ESP32 connects to Wi-Fi, it broadcasts a UDP discovery packet on port `5005`.
- The Node.js backend (`poultry-backend`) automatically detects the camera, replies with its current LAN IP (`http://<PC_IP>:3000/api/devices/ESP32_CAM_01/frames`), and the camera auto-configures itself!
- If your computer's IP address ever changes (e.g. router DHCP reboots), the camera will automatically re-discover the new IP on its next cycle.

---

## Accessing the Camera without IP (`poultrycam.local`)

You never need to check the Serial Monitor for the camera's router IP:
- Open your browser to:
  ```text
  http://poultrycam.local
  ```
- To adjust settings at any time:
  ```text
  http://poultrycam.local/setup
  ```

To wipe saved settings and force the camera back into Setup Hotspot mode, click **"Reset to Factory Defaults"** at the bottom of the `/setup` page.

---

## Wiring and Upload

For normal operation, connect only the ESP32-CAM to the ESP32-CAM-MB programmer and USB.

1. Insert the ESP32-CAM into the ESP32-CAM-MB.
2. Connect the MB board to USB.
3. Put the board into download mode (hold `BOOT`/`IO0` or press MB switch depending on revision).
4. Upload the sketch from Arduino IDE.
5. Disconnect GPIO0 from GND (or return switch to run mode).
6. Press the reset button on the ESP32-CAM.

---

## Troubleshooting

- **Portal doesn't show up when connecting to `PoultryCam-Setup`**: Open your browser and type `http://192.168.4.1/setup` manually.
- **ESP32-CAM Brownout / Crash**: The camera module draws high peak currents when turning on Wi-Fi and the camera sensor simultaneously. Ensure you use a quality USB cable and a reliable 5V/2A power source.
- **5GHz Wi-Fi**: ESP32 only supports **2.4GHz** Wi-Fi networks. Make sure your router or mobile hotspot broadcasts a 2.4GHz band.
- **Backend Uploads**: Always use the local IP of your backend machine (e.g. `192.168.X.X`), never `127.0.0.1` or `localhost`.