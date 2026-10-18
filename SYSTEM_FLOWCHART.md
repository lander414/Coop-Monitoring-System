# Poultry Coop Monitoring System — Architecture & Flowcharts

This document outlines the complete operational workflow and data flow of the **Poultry Coop Monitoring System**, featuring a dual-ESP32 hardware architecture:
1. **ESP32-CAM (AI-Thinker)** — Dedicated to visual monitoring, image acquisition, and frame uploading.
2. **ESP32 Sensor Controller (ESP32-WROOM / NodeMCU)** — Dedicated to environmental sensing (temperature & humidity), chicken presence/motion detection, and local status indication/actuation.

---

## 1. High-Level System Architecture Flowchart

```mermaid
flowchart TB
    %% Nodes styling
    classDef hardware fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0f172a
    classDef backend fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#0f172a
    classDef ai fill:#ede9fe,stroke:#7c3aed,stroke-width:2px,color:#0f172a
    classDef db fill:#ecfdf5,stroke:#059669,stroke-width:2px,color:#0f172a
    classDef client fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#0f172a

    subgraph Coop_Hardware["Coop Hardware Layer (Dual ESP32s)"]
        direction TB

        subgraph ESP32_CAM_Sub["ESP32-CAM (Vision Unit: ESP32_CAM_01)"]
            CAM_HW["OV2640 Camera Sensor<br/>+ PSRAM (AI-Thinker)"]
            CAM_CTRL["ESP32-CAM Firmware<br/>- Frame Capture Engine<br/>- UDP Auto-Discovery (Port 5005)<br/>- Local Web Server (:80)"]
            CAM_HW --> CAM_CTRL
        end

        subgraph ESP32_SENSOR_Sub["ESP32 Sensor Controller (Telemetry Unit: ESP32_COOP_01)"]
            SENS_DHT["DHT22 / DHT11 Sensor<br/>(Temperature & Humidity)"]
            SENS_PIR["PIR Motion / Radar Sensor<br/>(Chicken Presence & Motion)"]
            SENS_ACT["Local Actuators / RGB LED<br/>(Green / Yellow / Red / Fan Relay)"]
            SENS_CTRL["ESP32 Sensor Firmware<br/>- Read Cycle (5-10s)<br/>- Local Heat Index Calc<br/>- Actuator Control"]

            SENS_DHT --> SENS_CTRL
            SENS_PIR --> SENS_CTRL
            SENS_CTRL -.->|PWM / Relay| SENS_ACT
        end
    end

    subgraph Central_Backend["Central Server (Node.js & Express API)"]
        DISCOVERY["UDP Discovery Service<br/>(Listens :5005, announces LAN IP)"]
        API_GATEWAY["Express API Gateway & Auth<br/>(Port 5000 / 3000)"]
        TELEMETRY_ROUTE["Telemetry Ingest<br/>POST /api/monitoring"]
        CAMERA_ROUTE["Frame Ingest & Queue<br/>POST /api/devices/:id/frames"]
        RISK_ENGINE["Multi-Factor Risk Engine<br/>- Environmental Heat Index<br/>- Motion Activity<br/>- AI Visual Stress Assessment"]
        FRAME_SERVICE["Camera Frame Worker<br/>(Async Queue Processor)"]

        API_GATEWAY --> TELEMETRY_ROUTE
        API_GATEWAY --> CAMERA_ROUTE
        CAMERA_ROUTE --> FRAME_SERVICE
        TELEMETRY_ROUTE --> RISK_ENGINE
    end

    subgraph External_AI["External AI Cloud Services"]
        GEMINI_AI["Google Gemini 1.5 Flash<br/>- Visual Heat Stress Detection<br/>- Panting / Wing Spreading / Posture<br/>- Suggestive Care Instructions"]
    end

    subgraph Data_Persistence["Database & Storage (Supabase & Local)"]
        SUPABASE_DB[("Supabase PostgreSQL<br/>- telemetry_logs<br/>- camera_frames<br/>- auth.users")]
        LOCAL_STORAGE[("Local Disk Storage<br/>/uploads directory")]
    end

    subgraph Presentation_Layer["User Presentation (React Dashboard)"]
        WEB_APP["React + TypeScript Dashboard<br/>- Live Environmental Gauges<br/>- Chicken Presence Status<br/>- Camera Snapshots & Live Feed<br/>- Historical Charts (24h/7d)<br/>- Manual Photo AI Analysis"]
        USER["Poultry Farmer / Operator"]
    end

    %% Connections
    CAM_CTRL -.->|UDP Broadcast :5005| DISCOVERY
    DISCOVERY -.->|UDP Unicast IP:Port| CAM_CTRL
    CAM_CTRL -->|HTTP POST multipart/form-data<br/>x-device-key| CAMERA_ROUTE
    SENS_CTRL -->|HTTP POST JSON<br/>x-device-key| TELEMETRY_ROUTE

    FRAME_SERVICE -->|Store JPEG| LOCAL_STORAGE
    FRAME_SERVICE -->|Analyze Image Frame| GEMINI_AI
    GEMINI_AI -->|Stress Risk & Indicators| FRAME_SERVICE
    FRAME_SERVICE -->|Store AI Results| SUPABASE_DB
    TELEMETRY_ROUTE -->|Insert Telemetry Log| SUPABASE_DB

    RISK_ENGINE -.->|Return Hardware Command<br/>RGB color / fan trigger| SENS_CTRL

    WEB_APP -->|GET /api/monitoring/latest & history| API_GATEWAY
    WEB_APP -->|GET /api/devices/:id/frames/latest| API_GATEWAY
    WEB_APP -->|POST /api/frames/manual-upload| API_GATEWAY
    API_GATEWAY -->|Query / Stream| SUPABASE_DB
    API_GATEWAY -->|Serve Image Stream| LOCAL_STORAGE

    USER <-->|Interact / Monitor| WEB_APP

    %% Apply Classes
    class CAM_HW,CAM_CTRL,SENS_DHT,SENS_PIR,SENS_ACT,SENS_CTRL hardware
    class DISCOVERY,API_GATEWAY,TELEMETRY_ROUTE,CAMERA_ROUTE,RISK_ENGINE,FRAME_SERVICE backend
    class GEMINI_AI ai
    class SUPABASE_DB,LOCAL_STORAGE db
    class WEB_APP,USER client
```

---

## 2. ESP32 Sensor Controller (`ESP32_COOP_01`) Flowchart

This microcontroller is stationed inside the coop to monitor environmental factors and flock presence.

```mermaid
flowchart TD
    Start(["Power On / Boot ESP32 Sensor Unit"]) --> InitPins["Initialize GPIO Pins<br/>- DHT Data Pin (GPIO 4/15)<br/>- PIR Motion Sensor (GPIO 13/27)<br/>- RGB LED / Relay (GPIO 12, 14, 26)"]
    InitPins --> ConnectWiFi{"Connect to 2.4GHz Wi-Fi<br/>(SSID & Password)"}

    ConnectWiFi -- Connection Failed --> RetryWiFi["Wait 5s & Retry Connection"]
    RetryWiFi --> ConnectWiFi

    ConnectWiFi -- Connected --> SensorLoop["Start Sensor Sampling Loop<br/>(Every 5 to 10 Seconds)"]

    SensorLoop --> ReadDHT["Read Ambient Temperature (°C)<br/>& Relative Humidity (%) from DHT22"]
    ReadDHT --> ReadPIR["Read Chicken Presence & Motion Status<br/>from PIR / Microwave Sensor"]

    ReadPIR --> ValidateReadings{"Valid Sensor<br/>Readings?"}
    ValidateReadings -- NaN / Sensor Fault --> LogError["Log Error to Serial & Use Cached Safe Values"]
    LogError --> WaitInterval

    ValidateReadings -- Valid --> CalcHeatIndex["Calculate Local Heat Index (HI):<br/>HI = T + 0.55 * (1 - RH/100) * (T - 14.5)"]
    CalcHeatIndex --> EvalLocalRisk{"Determine Preliminary Stress Risk<br/>- If !chicken_present: NONE<br/>- If HI >= 32.0°C: HIGH<br/>- If HI >= 27.0°C: MEDIUM<br/>- Else: LOW"}

    EvalLocalRisk --> UpdateLocalActuators["Update Local Actuators & RGB LED:<br/>- LOW: Solid Green<br/>- MEDIUM: Solid Yellow<br/>- HIGH: Red + Activate Ventilation Fan Relay"]

    UpdateLocalActuators --> BuildPayload["Build JSON Telemetry Payload:<br/>{ device_id: 'ESP32_COOP_01',<br/>  temperature, humidity, chicken_present }"]

    BuildPayload --> SendHTTP["HTTP POST to Backend<br/>/api/monitoring<br/>Header: x-device-key"]

    SendHTTP --> BackendResp{"HTTP Status 201?"}
    BackendResp -- Success --> LogSuccess["Telemetry Logged in Database"]
    BackendResp -- Fail / Network Timeout --> FallbackMode["Log Network Warning<br/>Continue Local Loop Autonomously"]

    LogSuccess --> WaitInterval["Wait Telemetry Interval (e.g., 5000ms)"]
    FallbackMode --> WaitInterval
    WaitInterval --> SensorLoop
```

### Sensor ESP32 Pinout & Component Allocation

| Component | Pin (Recommended) | Description |
| :--- | :--- | :--- |
| **DHT22 / DHT11** | `GPIO 4` | Ambient temperature and humidity data line with 10kΩ pull-up |
| **PIR Motion Sensor** | `GPIO 13` | Digital HIGH/LOW output indicating flock movement / presence |
| **RGB LED - Red** | `GPIO 12` | Active indicator for `HIGH` stress risk |
| **RGB LED - Green** | `GPIO 14` | Active indicator for `LOW` nominal risk |
| **RGB LED - Blue** | `GPIO 27` | Active indicator for status / Wi-Fi state |
| **Relay Module** | `GPIO 26` | Switches 12V/220V coop exhaust fan / cooling mister on `HIGH` risk |
| **Power Supply** | `5V / 2A (VIN)` | Regulated power supply for ESP32 and attached sensors |

---

## 3. ESP32-CAM (`ESP32_CAM_01`) Flowchart

This microcontroller is dedicated to image capture, frame streaming, and sending visual data for AI analysis.

```mermaid
flowchart TD
    CamBoot(["Power On / Boot ESP32-CAM"]) --> CamInit["Initialize Camera Driver (OV2640)<br/>Configure Resolution (XGA / VGA)<br/>Set JPEG Quality & PSRAM Settings"]
    CamInit --> CamCheck{"Camera Ready?"}
    CamCheck -- Error --> CamHalt["Blink Flash LED & Halt / Restart"]

    CamCheck -- OK --> CamWiFi{"Connect to 2.4GHz Wi-Fi"}
    CamWiFi -- Failed --> CamWiFiRetry["Retry Wi-Fi with Exponential Backoff"]
    CamWiFiRetry --> CamWiFi

    CamWiFi -- Connected --> StartLocalWeb["Start Local Web Server (:80)<br/>- / (Status UI)<br/>- /capture (Manual Snapshot)<br/>- mDNS: poultrycam.local"]
    StartLocalWeb --> SendUDP["Broadcast UDP Packet on Port 5005<br/>'POULTRY_CAM_DISCOVERY'"]

    SendUDP --> ListenDiscovery{"Backend Responds<br/>within 3s?"}
    ListenDiscovery -- Yes --> SetDynamicURL["Update Ingest URL with Discovered LAN IP"]
    ListenDiscovery -- No / Timeout --> SetDefaultURL["Use Configured DEFAULT_BACKEND_URL"]

    SetDynamicURL --> CaptureTimerLoop["Enter Capture Interval Loop (Every 30s)"]
    SetDefaultURL --> CaptureTimerLoop

    CaptureTimerLoop --> TriggerCapture["Capture Still Frame (fb_get)"]
    TriggerCapture --> ValidateFB{"Frame Buffer Valid?"}
    ValidateFB -- Null / Corrupt --> ReleaseFB["Release Frame Buffer & Skip Cycle"]
    ReleaseFB --> SleepCapture

    ValidateFB -- Valid JPEG --> PrepUpload["Prepare Multipart HTTP POST Request<br/>- Header: x-device-key<br/>- Body: captured_at, sequence_id, firmware_version<br/>- File: image/jpeg payload"]

    PrepUpload --> UploadFrame["Transmit to Backend<br/>POST /api/devices/ESP32_CAM_01/frames"]

    UploadFrame --> CheckUploadStatus{"HTTP Status 202 Accepted?"}
    CheckUploadStatus -- Yes --> FreeFBSuccess["Free Frame Buffer & Update Last Upload Time"]
    CheckUploadStatus -- Error / Timeout --> FreeFBFail["Free Frame Buffer & Record Failure Stat"]

    FreeFBSuccess --> SleepCapture["Delay Until Next Interval (30s)"]
    FreeFBFail --> SleepCapture
    SleepCapture --> CaptureTimerLoop
```

---

## 4. Backend Processing & Multi-Factor Risk Fusion Flowchart

The Node.js/Express backend fuses telemetry from the Sensor ESP32 with visual inference from the ESP32-CAM.

```mermaid
flowchart TD
    subgraph Ingestion_Pipelines["Data Ingestion"]
        T_IN["Telemetry Input<br/>(ESP32 Sensor Unit)"]
        C_IN["Camera Frame Input<br/>(ESP32-CAM)"]
    end

    subgraph Telemetry_Branch["Environmental Branch"]
        T_IN --> T_AUTH{"Validate Device Key<br/>(x-device-key)"}
        T_AUTH -- Unauthorized --> T_403["Reject 403 Forbidden"]
        T_AUTH -- Valid --> T_PARSE["Extract temp, humidity, chicken_present"]
        T_PARSE --> T_CALC["Calculate Heat Index (HI):<br/>T + 0.55 * (1 - RH/100) * (T - 14.5)"]
        T_CALC --> T_RISK["Determine Environmental Risk:<br/>- If !chicken_present: NONE<br/>- If HI >= 32°C: HIGH<br/>- If HI >= 27°C: MEDIUM<br/>- Else: LOW"]
        T_RISK --> T_DB["Insert into Supabase<br/>table: telemetry_logs"]
    end

    subgraph Camera_Branch["Vision & AI Branch"]
        C_IN --> C_AUTH{"Validate Device Key<br/>(x-device-key)"}
        C_AUTH -- Unauthorized --> C_403["Reject 403 Forbidden"]
        C_AUTH -- Valid --> C_STORE["Save JPEG to /uploads directory<br/>with unique timestamp"]
        C_STORE --> C_DB["Insert 'pending' record into<br/>table: camera_frames"]
        C_DB --> C_QUEUE["Push Frame to In-Memory Queue"]
        C_QUEUE --> C_WORKER["Async Queue Worker picks up Frame"]
        C_WORKER --> C_GEMINI["Send to Gemini 1.5 Flash Vision API<br/>Prompt: Detect heat stress behaviors<br/>(panting, wing spreading, lethargy, eye closing)"]
        C_GEMINI --> C_RES["Parse Structured AI JSON:<br/>{ stress_risk, confidence, indicators, suggestions }"]
        C_RES --> C_UPDATE_DB["Update camera_frames record<br/>status: 'completed', ai_stress_risk, indicators"]
    end

    subgraph Risk_Fusion_Engine["Multi-Factor Risk Engine (Combined Assessment)"]
        T_RISK -.-> FUSION["calculateCombinedStressRisk()"]
        C_RES -.-> FUSION
        FUSION --> DECISION{"Evaluate Parameters"}

        DECISION -- Chicken Absent --> R_NONE["Final Risk: NONE<br/>(Bypass Stress Evaluation)"]
        DECISION -- Env HIGH or AI HIGH --> R_HIGH["Final Risk: HIGH<br/>(Trigger Critical Alert & Cooling)"]
        DECISION -- Env MEDIUM or AI MEDIUM or (Low Motion at Elev Temp) --> R_MED["Final Risk: MEDIUM<br/>(Warning Alert & Increase Airflow)"]
        DECISION -- All Nominal --> R_LOW["Final Risk: LOW<br/>(Conditions Optimal)"]

        R_HIGH --> ACT_SIGNAL["Generate Hardware Command:<br/>RGB: RED, Fan: ON, Buzzer: Pulse"]
        R_MED --> ACT_SIGNAL_M["Generate Hardware Command:<br/>RGB: YELLOW, Fan: ECO"]
        R_LOW --> ACT_SIGNAL_L["Generate Hardware Command:<br/>RGB: GREEN, Fan: OFF"]
    end
```

---

## 5. Web Dashboard & User Interaction Flowchart

```mermaid
flowchart TD
    User(["Poultry Farm Operator"]) --> OpenBrowser["Open Web Dashboard (Vite + React)"]
    OpenBrowser --> AuthCheck{"Authenticated Session?"}

    AuthCheck -- No --> LoginPage["Login with Supabase Credentials"]
    LoginPage --> AuthCheck

    AuthCheck -- Yes --> LoadDashboard["Load Live Monitoring Dashboard"]

    subgraph Polling_Engine["Real-time Polling Engine (Every 5s)"]
        LoadDashboard --> PollTelemetry["GET /api/monitoring/latest"]
        LoadDashboard --> PollCamera["GET /api/devices/ESP32_CAM_01/frames/latest"]
        LoadDashboard --> PollHistory["GET /api/monitoring/history?limit=50"]

        PollTelemetry --> UpdateGauges["Update Real-Time Gauges:<br/>- Current Temperature<br/>- Humidity Level<br/>- Heat Index<br/>- Chicken Presence Status"]
        PollCamera --> UpdateFrame["Render Latest Coop Camera Image<br/>+ Visual AI Risk Tag & Indicators"]
        PollHistory --> UpdateCharts["Render 24h Interactive Trend Charts<br/>(Heat Index vs Ambient Temperature)"]
    end

    subgraph Manual_Inspection["On-Demand Manual Inspection"]
        User --> UploadPhoto["Upload Chicken Photo from Mobile/Desktop"]
        UploadPhoto --> PostManual["POST /api/frames/manual-upload"]
        PostManual --> GeminiInspect["Gemini AI Visual Diagnostic"]
        GeminiInspect --> ShowResults["Display Instant AI Feedback Modal:<br/>- Stress Risk Level & Confidence<br/>- Detected Behavioral Indicators<br/>- Actionable Farm Management Suggestions"]
    end

    subgraph Actionable_Alerts["Alert & Notification Workflow"]
        UpdateGauges --> CheckRiskLevel{"Stress Risk Level"}
        CheckRiskLevel -- HIGH --> BannerAlert["Show High-Risk Red Alert Banner<br/>'Heat Stress Emergency: Activate Coop Ventilation'"]
        CheckRiskLevel -- MEDIUM --> ToastAlert["Show Moderate Yellow Alert Toast<br/>'Caution: Heat Index is Rising'"]
        CheckRiskLevel -- LOW / NONE --> NormalStatus["Display Green 'Optimal Flock Comfort' Badge"]
    end
```

---

## 6. End-to-End Data Payloads & API Contracts

### A. Sensor Telemetry Payload (`ESP32_COOP_01` → Backend)
- **Endpoint**: `POST /api/monitoring`
- **Header**: `x-device-key: <DEVICE_INGEST_KEY>`, `Content-Type: application/json`

```json
{
  "device_id": "ESP32_COOP_01",
  "temperature": 33.5,
  "humidity": 68.2,
  "chicken_present": true
}
```

**Calculated by Backend & Saved to `telemetry_logs`:**
```json
{
  "id": 1042,
  "device_id": "ESP32_COOP_01",
  "temperature": 33.5,
  "humidity": 68.2,
  "heat_index": 39.8,
  "chicken_present": true,
  "stress_risk": "HIGH",
  "created_at": "2026-10-14T17:45:00.000Z"
}
```

---

### B. Camera Frame Ingest Payload (`ESP32_CAM_01` → Backend)
- **Endpoint**: `POST /api/devices/ESP32_CAM_01/frames`
- **Header**: `x-device-key: <DEVICE_INGEST_KEY>`, `Content-Type: multipart/form-data`
- **Form Fields**:
  - `captured_at`: ISO 8601 Timestamp
  - `sequence_id`: Sequence counter
  - `firmware_version`: `"esp32cam-static-1.3"`
  - `image`: Binary JPEG file (`image/jpeg`)

**Backend Response (202 Accepted):**
```json
{
  "success": true,
  "message": "Camera frame uploaded and queued for analysis.",
  "data": {
    "frameId": "3f4219b6-89d1-4475-ba7c-728b4081efbc",
    "deviceId": "ESP32_CAM_01",
    "status": "pending"
  }
}
```

---

### C. Gemini AI Visual Output Schema
```json
{
  "stress_risk": "HIGH",
  "confidence": 0.94,
  "indicators": [
    "Open-mouth panting",
    "Wings held away from body (drooping)",
    "Severe lethargy and crouching"
  ],
  "description": "Flock exhibits pronounced behavioral symptoms of severe heat stress.",
  "suggestions": [
    "Engage full exhaust fans and evaporative cooling pads immediately.",
    "Inspect water lines to guarantee cool, unrestricted drinking water.",
    "Dim coop lighting slightly to reduce flock activity."
  ]
}
```

---

### D. Combined Risk Evaluation (`POST /api/evaluate-risk`)
- **Combined Risk Logic**:
  - If `chicken_present == false` or `aiStressRisk == "NONE"` $\rightarrow$ `NONE`
  - If `heat_index >= 32.0` OR `aiStressRisk == "HIGH"` $\rightarrow$ `HIGH`
  - If `heat_index >= 27.0` OR `aiStressRisk == "MEDIUM"` OR `motionLevel == "LOW"` $\rightarrow$ `MEDIUM`
  - Otherwise $\rightarrow$ `LOW`

**Response Payload**:
```json
{
  "success": true,
  "timestamp": "2026-10-14T17:45:00.000Z",
  "data": {
    "sensorInputs": {
      "temperature": 33.5,
      "humidity": 68.2,
      "heatIndex": 39.8,
      "motionLevel": "LOW",
      "aiStressRisk": "HIGH"
    },
    "aiResult": {
      "stress_risk": "HIGH",
      "confidence": 0.94,
      "indicators": ["Open-mouth panting", "Wings drooping"]
    },
    "finalAssessment": {
      "finalStressRisk": "HIGH",
      "environmentalRisk": "HIGH",
      "evaluationSummary": "Critical ambient Heat Index detected. High observable behavioral stress indicators present in image."
    },
    "hardwareCommand": {
      "rgbIndicator": { "color": "RED", "red": 255, "green": 0, "blue": 0 }
    }
  }
}
```

---

## 7. System Component Matrix

| Subsystem | Hardware / Framework | Primary Responsibility | Data Transmission |
| :--- | :--- | :--- | :--- |
| **Vision Node** | AI-Thinker ESP32-CAM (OV2640) | Periodic snapshot capture, local web status, UDP discovery | Wi-Fi HTTP POST (JPEG multipart) |
| **Sensor Node** | ESP32 Dev Board (DHT22 + PIR) | Environmental monitoring, flock presence detection, local alerts | Wi-Fi HTTP POST (JSON telemetry) |
| **Backend API** | Node.js, Express, Multer | Device authentication, telemetry ingestion, frame queuing | REST API + UDP discovery broadcast |
| **AI Engine** | Google Gemini 1.5 Flash Vision | Multi-modal visual heat stress analysis and poultry diagnostics | REST API (Cloud JSON) |
| **Database** | Supabase (PostgreSQL) | Persistence for time-series telemetry, image metadata, auth | PostgREST / Supabase JS SDK |
| **Frontend** | React, TypeScript, Vite, Tailwind | Real-time dashboards, historical charting, manual photo upload | HTTP Polling (5s interval) |
