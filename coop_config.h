#ifndef COOP_CONFIG_H
#define COOP_CONFIG_H

// ==============================================================================
// POULTRY COOP MASTER NETWORK & BACKEND CONFIGURATION
// Edit this SINGLE file to configure BOTH the Sensor Node and the Camera Node!
// ==============================================================================

// 1. Wi-Fi / Mobile Hotspot Credentials
// Set this to your phone's Personal Hotspot or home Wi-Fi (2.4 GHz only).
// Make sure your computer running the Node.js backend is on the SAME Wi-Fi!
#define COOP_WIFI_SSID            "Lander Agustin"
#define COOP_WIFI_PASSWORD        "dodoy414"

// 2. Node.js Backend Server IP & Port
// Run `ipconfig` in PowerShell on your PC to see your computer's IPv4 address:
#define COOP_BACKEND_HOST          "10.43.115.191"
#define COOP_BACKEND_PORT          3000
#define COOP_BACKEND_PORT_STR      "3000"

// 3. Security Ingest Key (Matches DEVICE_INGEST_KEY in poultry-backend/.env)
#define COOP_DEVICE_INGEST_KEY     "c69d3b007c0243369f7a7613ed324e612dcd222c0e924f5c9325470597c80379"

// 4. Device Identification
#define SENSOR_NODE_DEVICE_ID      "ESP32_COOP_01"
#define CAMERA_NODE_DEVICE_ID      "ESP32_CAM_01"

// 5. Sampling & Telemetry Intervals
#define SENSOR_TELEMETRY_INTERVAL_MS   15000UL   // 15 seconds for testing (change to 120000UL for 2 min in production)
#define CAMERA_CAPTURE_INTERVAL_MS     30000UL   // 30 seconds between auto-captures

#endif // COOP_CONFIG_H
