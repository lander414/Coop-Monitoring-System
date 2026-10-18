@echo off
REM Poultry Coop Configuration Synchronizer
REM Copies the master coop_config.h to both ESP32 firmware sketch folders
cd /d "%~dp0"
copy /Y coop_config.h esp32_sensor_firmware\coop_config.h >nul
copy /Y coop_config.h esp32cam_firmware\coop_config.h >nul
echo [SUCCESS] Both ESP32 firmware folders are synchronized with coop_config.h!
echo   - esp32_sensor_firmware\coop_config.h
echo   - esp32cam_firmware\coop_config.h
