# ESP32 SIM Module + DHT22 & PIR Sensor Firmware

This firmware reads environmental telemetry (**DHT22** temperature & humidity) and flock movement/activity (**PIR sensor**), formats the data into JSON, and transmits it to the Poultry Monitoring Node.js backend (`POST /api/monitoring`) via **Cellular GPRS (SIM Card)** or optional **Wi-Fi**.

---

## 1. System Overview & Sensor Logic

```
   +-------------------------------------------------------+
   |          ESP32 with Integrated SIM Module             |
   |                                                       |
   |  [PIR Sensor]  ---> Chicken movement window sample   |
   |                     (Activity detected = true/false)  |
   |                                                       |
   |  [DHT22]       ---> Temp (°C) + Humidity (%)          |
   +-------------------------------------------------------+
                              |
                     Cellular GPRS / GSM
                     (or Wi-Fi Fallback)
                              |
                              v
             +----------------------------------+
             |   poultry-backend (Node.js)      |
             |   POST /api/monitoring           |
             |   - Calculates Heat Index        |
             |   - Assesses Flock Stress Risk   |
             |   - Saves to Supabase            |
             +----------------------------------+
                              |
                              v
             +----------------------------------+
             |   poultry-frontend (React UI)    |
             |   - Live Flock Activity Status   |
             |   - Heat Index Gauges & History  |
             +----------------------------------+
```

### Chicken Activity Logic
* **PIR Sensor (Passive Infrared)**: Measures infrared radiation emitted by moving bodies.
* When chickens move around the coop within a 15-second sampling window (configurable via `SEND_INTERVAL_MS`), the PIR sensor pulses HIGH and increments a counter via hardware interrupt.
* If any motion pulses are registered during the window (`motionPulseCount > 0` or pin state is `HIGH`), `chicken_present` is flagged as `true` (**Activity Detected**).
* If no motion occurs (e.g. coop is empty or birds are still/resting), `chicken_present` is flagged as `false` (**No Activity Detected**).

### Environmental Logic
* **DHT22**: Measures ambient temperature and relative humidity.
* The backend automatically computes the **Heat Index** and assesses flock heat stress risk (`NONE`, `LOW`, `MEDIUM`, `HIGH`) based on thermal load and activity.

---

## 2. Hardware Wiring & Pinout

### For LilyGO TTGO T-Call (ESP32 SIM800L)
| Sensor / Peripheral | Sensor Pin | ESP32 GPIO | Notes |
| :--- | :--- | :--- | :--- |
| **PIR Sensor** | VCC | 5V (or 3.3V) | Check your PIR sensor voltage jumper |
| | GND | GND | Ground |
| | OUT | **GPIO 13** | Hardware interrupt enabled |
| **DHT22** | VCC | 3.3V / 5V | |
| | DATA | **GPIO 14** | Add 10kΩ pull-up to 3.3V if using raw sensor |
| | GND | GND | Ground |
| **SIM800L Internal** | TX / RX | GPIO 27 / 26 | Internal on board |
| | Power/Key | GPIO 23 / 4 | Controlled by sketch |

> **Note on GPIOs**: On TTGO T-Call, GPIO 21 & 22 are reserved for the internal IP5306 power management chip via I2C. Use **GPIO 14** for DHT22 and **GPIO 13** for PIR.

### For Generic ESP32 + External SIM800L / A7670
| Module | Module Pin | ESP32 GPIO |
| :--- | :--- | :--- |
| **SIM Module** | TX | **GPIO 16** (RX2) |
| | RX | **GPIO 17** (TX2) |
| | GND | Common GND with ESP32 |
| | VCC / 5V | External 5V 2A Power Source |
| **PIR Sensor** | OUT | **GPIO 13** |
| **DHT22** | DATA | **GPIO 21** |

> **Power Supply Warning for Cellular Modules**: SIM800L/A7670 can pull brief transmission burst currents up to **2A**. Powering the SIM module solely from a standard computer USB 2.0 port (500mA) can cause brownout reset loops. Use a quality 5V 2A USB power adapter or a 3.7V LiPo battery plugged into the board's battery connector.

---

## 3. Arduino IDE Setup & Libraries

1. In Arduino IDE, open **Tools > Manage Libraries...** and install:
   - **TinyGSM** (by Volodymyr Shymanskyy)
   - **ArduinoHttpClient** (by Arduino)
   - **DHT sensor library** (by Adafruit)
   - **Adafruit Unified Sensor** (by Adafruit)

2. Under **Tools > Board**, select:
   - `ESP32 Dev Module` (or `TTGO T-Call` if listed in your board package)

3. Upload settings:
   - Upload Speed: `115200` or `921600`
   - Flash Frequency: `80MHz`
   - Partition Scheme: `Default 4MB with spiffs`

---

## 4. Centralized Configuration (Single File for Both ESP32s)

Both the **ESP32 Sensor Node** and the **ESP32-CAM Node** share configuration from a single file:
👉 **[coop_config.h](file:///c:/Users/razel/Documents/GitHub/Coop-Monitoring-System/coop_config.h)** (in the project root)

```cpp
// 1. Wi-Fi / Hotspot Credentials
#define COOP_WIFI_SSID            "Lander Agustin"
#define COOP_WIFI_PASSWORD        "dodoy414"

// 2. Node.js Backend Server IP & Port (Your PC's IP address)
#define COOP_BACKEND_HOST          "192.168.100.14"
#define COOP_BACKEND_PORT          3000
#define COOP_BACKEND_PORT_STR      "3000"

// 3. Security Ingest Key
#define COOP_DEVICE_INGEST_KEY     "c69d3b007c0243369f7a7613ed324e612dcd222c0e924f5c9325470597c80379"
```

After modifying [coop_config.h](file:///c:/Users/razel/Documents/GitHub/Coop-Monitoring-System/coop_config.h), run `sync-config.bat` (or let it auto-mirror) to sync both sketch folders.

---

## 5. Testing & Verification

1. **Verify Backend is running**:
   ```powershell
   cd "C:\Users\razel\Documents\GitHub\Coop-Monitoring-System\poultry-backend"
   node server.js
   ```
2. **Open Arduino Serial Monitor** at `115200` baud.
3. Observe sensor readings and connection logs:
   ```text
   [SENSORS] DHT22 and PIR initialized.
   [CELLULAR] Modem Info: SIM800 R14.18
   [CELLULAR] Waiting for network registration... Registered!
   [CELLULAR] Connecting to APN: internet.globe.com.ph
   [CELLULAR] GPRS Connected successfully!

   --- [TELEMETRY SAMPLE] ---
   Temperature: 28.6 °C
   Humidity:    64.2 %
   PIR Pulses:  4 | Active: YES (Chickens moving)
   [CELLULAR-HTTP] Status code: 201
   [CELLULAR-HTTP] Response: {"success":true,"message":"Monitoring telemetry stored successfully"}
   ```
4. **View in Dashboard**:
   Open `http://localhost:5173` or your frontend dashboard:
   - **Chicken Status** card will update live to **"Activity detected"** (or **"No activity detected"**).
   - Real-time temperature, humidity, and heat index charts will plot incoming readings.
