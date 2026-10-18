# Flowchart — Coop Monitoring System

See the complete, illustrated flowchart specification and hardware architecture document here:
- [SYSTEM_FLOWCHART.md](file:///c:/Users/sophi/OneDrive/Documents/GitHub/Coop-Monitoring-System/SYSTEM_FLOWCHART.md)

---

### Quick Jump Links in `SYSTEM_FLOWCHART.md`:
1. **[1. High-Level System Architecture Flowchart](file:///c:/Users/sophi/OneDrive/Documents/GitHub/Coop-Monitoring-System/SYSTEM_FLOWCHART.md#1-high-level-system-architecture-flowchart)** — Dual-ESP32 architecture (ESP32-CAM and Sensor ESP32), backend, Gemini AI, Supabase, and React dashboard.
2. **[2. ESP32 Sensor Controller (ESP32_COOP_01) Flowchart](file:///c:/Users/sophi/OneDrive/Documents/GitHub/Coop-Monitoring-System/SYSTEM_FLOWCHART.md#2-esp32-sensor-controller-esp32_coop_01-flowchart)** — DHT22/DHT11 temperature & humidity, PIR motion/presence sensor, local heat index calculation, and RGB/relay actuation.
3. **[3. ESP32-CAM (ESP32_CAM_01) Flowchart](file:///c:/Users/sophi/OneDrive/Documents/GitHub/Coop-Monitoring-System/SYSTEM_FLOWCHART.md#3-esp32-cam-esp32_cam_01-flowchart)** — OV2640 capture cycle, UDP discovery service, and frame upload to backend.
4. **[4. Backend Processing & Multi-Factor Risk Fusion Flowchart](file:///c:/Users/sophi/OneDrive/Documents/GitHub/Coop-Monitoring-System/SYSTEM_FLOWCHART.md#4-backend-processing--multi-factor-risk-fusion-flowchart)** — Risk fusion engine combining environmental heat index, motion level, and Gemini visual stress analysis.
5. **[5. Web Dashboard & User Interaction Flowchart](file:///c:/Users/sophi/OneDrive/Documents/GitHub/Coop-Monitoring-System/SYSTEM_FLOWCHART.md#5-web-dashboard--user-interaction-flowchart)** — React client polling, manual photo upload, and actionable alerts.
6. **[6. End-to-End Data Payloads & API Contracts](file:///c:/Users/sophi/OneDrive/Documents/GitHub/Coop-Monitoring-System/SYSTEM_FLOWCHART.md#6-end-to-end-data-payloads--api-contracts)** — JSON schemas and HTTP endpoints.
