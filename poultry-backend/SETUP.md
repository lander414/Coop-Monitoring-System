# Poultry Backend Setup Guide

## 1) Open the backend folder

```powershell
cd "C:\Users\razel\Documents\GitHub\Coop-Monitoring-System\poultry-backend"
```

## 2) Install dependencies

```powershell
npm install
```

## 3) Create the environment file

Create a file named `.env` inside the backend folder:

```text
C:\Users\razel\Documents\GitHub\Coop-Monitoring-System\poultry-backend\.env
```

Add these variables:

```env
PORT=3000
GEMINI_API_KEY=your_actual_gemini_api_key_here
NODE_ENV=development
DEVICE_INGEST_KEY=replace-with-a-long-random-device-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-supabase-service-role-key
```

Important:
- If the key is missing, placeholder, or invalid, the app will fall back to mock analysis.
- The backend reads `.env` from the folder where it is started, so the backend-local file matters.
- Browser dashboard routes require a Supabase Auth access token.
- ESP32 telemetry posts to `/api/monitoring` with the `x-device-key` header matching `DEVICE_INGEST_KEY`.
- ESP32-CAM frames post to `/api/devices/<device-id>/frames` with the same `x-device-key` header. The firmware does not use a Supabase user token.
- The backend uses `SUPABASE_SERVICE_ROLE_KEY` for server-side frame persistence. Never place this key in the ESP32 firmware or frontend.

## 4) Start the backend

```powershell
node server.js
```

Expected output:

```text
Server running on http://127.0.0.1:3000
```

If the key is invalid or missing, you may also see:

```text
API Key missing or invalid. Returning local mock analysis for COOP-16.
```

This is expected fallback behavior, not a crash.

## 5) Test the image upload endpoint

Open a second terminal and run:

```powershell
curl -X POST http://127.0.0.1:3000/api/images -F "image=@C:\path\to\your-image.jpg;type=image/jpeg"
```

Example:

```powershell
curl -X POST http://127.0.0.1:3000/api/images -F "image=@C:\Users\razel\Pictures\chicken.jpg;type=image/jpeg"
```

Successful response example:

```json
{
  "success": true,
  "message": "Image successfully validated and stored.",
  "data": {
    "imageId": "img-123456789.png",
    "originalName": "chicken.jpg",
    "mimeType": "image/jpeg"
  }
}
```

## 6) Test the full risk evaluation endpoint

```powershell
curl -X POST http://127.0.0.1:3000/api/evaluate-risk `
  -F "image=@C:\path\to\your-image.jpg;type=image/jpeg" `
  -F "mock_temp=33.5" `
  -F "mock_humidity=70" `
  -F "mock_heat_index=38.2" `
  -F "mock_motion=LOW"
```

This sends:
- the uploaded image
- temperature
- humidity
- heat index
- motion level

The API returns:
- aiResult
- finalAssessment
- hardwareCommand

## 7) Prepare camera frame persistence

Run `supabase/camera_frames.sql` in the Supabase SQL editor before enabling ESP32-CAM uploads. This creates the frame metadata table and indexes used by the asynchronous analysis worker.

## 8) Test the ESP32-CAM frame endpoint

The ESP32-CAM sends a JPEG as the `image` multipart field. Use the backend machine's LAN IP, not `127.0.0.1`, when testing from the camera:

```powershell
curl -X POST http://192.168.x.x:3000/api/devices/ESP32_CAM_01/frames `
  -H "x-device-key: replace-with-a-long-random-device-key" `
  -F "image=@C:\path\to\camera-frame.jpg;type=image/jpeg" `
  -F "captured_at=2026-09-10T12:00:00Z" `
  -F "sequence_id=1" `
  -F "firmware_version=initial-test"
```

The endpoint returns a frame ID and `status: "pending"` with HTTP `202`. The backend then updates the record to `processing`, `completed`, or `failed` as Gemini analysis runs.

Authenticated dashboard clients can read the latest frame metadata with:

```text
GET /api/devices/<device-id>/frames/latest
Authorization: Bearer <Supabase access token>
```

The response includes a protected `imageUrl`. The dashboard must request that URL with the same Supabase bearer token; the ESP32 device key is not used by browser clients.

## 9) Open the browser dashboard

Visit:

```text
http://127.0.0.1:3000/dashboard
```

Then:
- upload an image
- enter mock values
- click Evaluate Risk

## 10) Stop the backend

Press:

```powershell
Ctrl + C
```

## Common issue

If the app says the API key is missing or invalid, check:

1. The `.env` file exists in the backend folder
2. The value is not a placeholder
3. You restarted the server after editing `.env`
4. You are running `node server.js` from the backend folder

## Notes

- The app is designed to use Gemini AI when the key is valid.
- If the key is not valid, it falls back to mock local analysis for testing.
- The backend is expected to run at port 3000.
