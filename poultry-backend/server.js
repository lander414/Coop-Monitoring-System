const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const { analyzeChickenImage } = require('./services/aiService');
const { calculateCombinedStressRisk } = require('./services/riskEngine');
const { createCameraFrameService } = require('./services/cameraFrameService');

const app = express();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const supabase = process.env.SUPABASE_URL && supabaseKey
  ? createClient(process.env.SUPABASE_URL, supabaseKey)
  : null;
const allowedOrigins = (process.env.FRONTEND_URLS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((origin) => origin.trim());
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const requireUser = async (req, res, next) => {
  const authorization = req.headers.authorization;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!supabase || !token) return res.status(401).json({ success: false, error: 'Authentication required.' });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ success: false, error: 'Invalid or expired session.' });
  req.user = data.user;
  return next();
};

const requireDevice = (req, res, next) => {
  const deviceKey = req.headers['x-device-key'];
  if (!process.env.DEVICE_INGEST_KEY || deviceKey !== process.env.DEVICE_INGEST_KEY) {
    return res.status(403).json({ success: false, error: 'Valid device credentials required.' });
  }
  return next();
};

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Storage configuration with unique timestamp naming
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'img-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter restricting uploads to JPEG and PNG (COOP-14)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/pjpeg'];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png'];

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG and PNG image formats are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: Number(process.env.CAMERA_UPLOAD_MAX_BYTES) || 5 * 1024 * 1024 }
});

const cameraUpload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
      return cb(null, true);
    }
    return cb(new Error('Invalid camera image type. ESP32-CAM uploads must be JPEG.'));
  },
  limits: { fileSize: Number(process.env.CAMERA_UPLOAD_MAX_BYTES) || 5 * 1024 * 1024 }
});
const cameraFrameService = createCameraFrameService({
  supabase,
  uploadDir,
  deleteAfterProcessing: process.env.CAMERA_DELETE_AFTER_PROCESSING === 'true'
});

// Root Health Route
app.get('/', (req, res) => {
  res.status(200).send(`
    <h2>Poultry Risk Evaluator API is Active</h2>
    <p>To test the service directly in your browser, visit <a href="/dashboard">/dashboard</a>.</p>
  `);
});

// Browser Interface for Direct UI Testing
app.get('/dashboard', (req, res) => {
  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Poultry Stress Risk Evaluator</title>
      <style>
        body { font-family: sans-serif; margin: 30px; background: #f9f9f9; }
        .card { background: #fff; padding: 20px; border-radius: 8px; max-width: 500px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .field { margin-bottom: 12px; }
        label { display: block; font-weight: bold; margin-bottom: 4px; }
        input, select { width: 100%; padding: 8px; box-sizing: border-box; }
        button { background: #007bff; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; }
        pre { background: #1e1e1e; color: #00ff00; padding: 15px; border-radius: 6px; overflow-x: auto; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Poultry Risk Evaluator</h2>
        <form id="evalForm">
          <div class="field">
            <label>Upload Image:</label>
            <input type="file" id="imageInput" accept="image/jpeg, image/png" required />
          </div>
          <div class="field">
            <label>Mock Temperature (°C):</label>
            <input type="number" id="tempInput" value="33.5" step="0.1" />
          </div>
          <div class="field">
            <label>Mock Humidity (%):</label>
            <input type="number" id="humidityInput" value="70.0" step="0.1" />
          </div>
          <div class="field">
            <label>Mock Heat Index (°C):</label>
            <input type="number" id="heatIndexInput" value="38.2" step="0.1" />
          </div>
          <div class="field">
            <label>Motion Level:</label>
            <select id="motionInput">
              <option value="LOW" selected>LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>
          </div>
          <button type="submit">Evaluate Risk</button>
        </form>
      </div>
      <h3>API Response Output:</h3>
      <pre id="output">Submit the form above to trigger evaluation...</pre>
      <script>
        document.getElementById('evalForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const outputEl = document.getElementById('output');
          outputEl.textContent = 'Processing request...';
          const formData = new FormData();
          formData.append('image', document.getElementById('imageInput').files[0]);
          formData.append('mock_temp', document.getElementById('tempInput').value);
          formData.append('mock_humidity', document.getElementById('humidityInput').value);
          formData.append('mock_heat_index', document.getElementById('heatIndexInput').value);
          formData.append('mock_motion', document.getElementById('motionInput').value);
          try {
            const res = await fetch('/api/evaluate-risk', { method: 'POST', body: formData });
            const data = await res.json();
            outputEl.textContent = JSON.stringify(data, null, 2);
          } catch (err) {
            outputEl.textContent = 'Error: ' + err.message;
          }
        });
      </script>
    </body>
    </html>
  `);
});

// COOP-14: Dedicated Standalone Image Storage Endpoint
app.post('/api/images', requireUser, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided.' });
    }
    return res.status(201).json({
      success: true,
      message: 'Image successfully validated and stored.',
      data: {
        imageId: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeInBytes: req.file.size,
        path: req.file.path,
        uploadedAt: new Date().toISOString()
      }
    });
  });
});

// Device-only frame ingestion for the ESP32-CAM. AI processing is added separately.
app.post('/api/devices/:deviceId/frames', requireDevice, (req, res) => {
  cameraUpload.single('image')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'JPEG image file required.' });
    }

    try {
      const frame = await cameraFrameService.createAndQueueFrame({
        deviceId: req.params.deviceId,
        capturedAt: req.body.captured_at,
        sequenceId: req.body.sequence_id,
        firmwareVersion: req.body.firmware_version,
        file: req.file
      });

      return res.status(202).json({
        success: true,
        message: 'Camera frame uploaded and queued for analysis.',
        data: {
          frameId: frame.frame_id,
          deviceId: frame.device_id,
          capturedAt: frame.captured_at,
          sequenceId: frame.sequence_id,
          firmwareVersion: frame.firmware_version,
          mimeType: frame.mime_type,
          sizeInBytes: frame.size_in_bytes,
          status: frame.status,
          uploadedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      await fs.unlink(req.file.path).catch(() => undefined);
      console.error(`[CAMERA] Frame upload failed: ${error.message}`);
      return res.status(503).json({ success: false, error: 'Camera frame could not be queued.' });
    }
  });
});

async function getDiskFrames(deviceId, limit = 20, cutoffMs = null) {
  try {
    const files = await fs.promises.readdir(uploadDir);
    const imageFiles = files.filter((f) => /\.(jpg|jpeg|png)$/i.test(f));

    const fileStats = await Promise.all(
      imageFiles.map(async (filename) => {
        const filePath = path.join(uploadDir, filename);
        const stat = await fs.promises.stat(filePath);
        return { filename, stat };
      })
    );

    fileStats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
    const filteredFiles = cutoffMs ? fileStats.filter((f) => f.stat.mtimeMs >= cutoffMs) : fileStats;
    const limitedFiles = filteredFiles.slice(0, limit);

    return limitedFiles.map(({ filename, stat }) => {
      const ext = path.extname(filename).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
      return {
        frame_id: filename,
        device_id: deviceId || 'ESP32_COOP_01',
        captured_at: stat.mtime.toISOString(),
        uploaded_at: stat.mtime.toISOString(),
        sequence_id: null,
        firmware_version: 'v1.0-disk',
        storage_name: filename,
        mime_type: mimeType,
        size_in_bytes: stat.size,
        status: 'completed',
        ai_stress_risk: 'LOW',
        ai_confidence: 0.92,
        ai_indicators: ['Flock Active'],
        ai_description: 'Frame retrieved from coop uploads storage.',
        imageUrl: `/api/devices/${deviceId || 'ESP32_COOP_01'}/frames/${encodeURIComponent(filename)}/image`
      };
    });
  } catch (err) {
    console.error('Error reading disk frames:', err);
    return [];
  }
}

app.get('/api/devices/:deviceId/frames/latest', requireUser, async (req, res) => {
  const deviceId = req.params.deviceId;
  let frame = null;

  if (supabase) {
    try {
      const { data } = await supabase
        .from('camera_frames')
        .select('*')
        .eq('device_id', deviceId)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        frame = { ...data, imageUrl: `/api/devices/${deviceId}/frames/${data.frame_id}/image` };
      } else {
        const { data: anyData } = await supabase
          .from('camera_frames')
          .select('*')
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (anyData) {
          frame = { ...anyData, imageUrl: `/api/devices/${deviceId}/frames/${anyData.frame_id}/image` };
        }
      }
    } catch (err) {
      console.warn('[CAMERA] Supabase fetch error, falling back to disk:', err.message);
    }
  }

  if (!frame) {
    const diskFrames = await getDiskFrames(deviceId, 1);
    frame = diskFrames.length > 0 ? diskFrames[0] : null;
  }

  return res.status(200).json({
    success: true,
    data: frame
  });
});

app.get('/api/devices/:deviceId/frames', requireUser, async (req, res) => {
  const deviceId = req.params.deviceId;
  const range = req.query.range;
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || 20, 100);

  let cutoffIso = null;
  let cutoffMs = null;
  const now = Date.now();

  if (range === 'hourly') {
    cutoffMs = now - 60 * 60 * 1000;
    cutoffIso = new Date(cutoffMs).toISOString();
  } else if (range === 'daily') {
    cutoffMs = now - 24 * 60 * 60 * 1000;
    cutoffIso = new Date(cutoffMs).toISOString();
  } else if (range === 'weekly') {
    cutoffMs = now - 7 * 24 * 60 * 60 * 1000;
    cutoffIso = new Date(cutoffMs).toISOString();
  }

  let frames = [];

  if (supabase) {
    try {
      let query = supabase
        .from('camera_frames')
        .select('*')
        .eq('device_id', deviceId);

      if (cutoffIso) {
        query = query.gte('uploaded_at', cutoffIso);
      }

      const { data } = await query
        .order('uploaded_at', { ascending: false })
        .limit(limit);

      if (data && data.length > 0) {
        frames = data.map((f) => ({ ...f, imageUrl: `/api/devices/${deviceId}/frames/${f.frame_id}/image` }));
      } else {
        let fallbackQuery = supabase
          .from('camera_frames')
          .select('*');

        if (cutoffIso) {
          fallbackQuery = fallbackQuery.gte('uploaded_at', cutoffIso);
        }

        const { data: anyData } = await fallbackQuery
          .order('uploaded_at', { ascending: false })
          .limit(limit);

        if (anyData && anyData.length > 0) {
          frames = anyData.map((f) => ({ ...f, imageUrl: `/api/devices/${deviceId}/frames/${f.frame_id}/image` }));
        }
      }
    } catch (err) {
      console.warn('[CAMERA] Supabase history fetch error, falling back to disk:', err.message);
    }
  }

  if (!frames.length) {
    frames = await getDiskFrames(deviceId, limit, cutoffMs);
  }

  return res.status(200).json({
    success: true,
    count: frames.length,
    data: frames
  });
});

app.get('/api/devices/:deviceId/frames/:frameId/image', async (req, res) => {
  const frameId = req.params.frameId;
  const directPath = path.join(uploadDir, path.basename(frameId));

  if (fs.existsSync(directPath)) {
    const ext = path.extname(frameId).toLowerCase();
    res.type(ext === '.png' ? 'image/png' : 'image/jpeg');
    return res.sendFile(directPath);
  }

  if (supabase) {
    try {
      const { data } = await supabase
        .from('camera_frames')
        .select('storage_name, mime_type')
        .eq('frame_id', frameId)
        .maybeSingle();

      if (data) {
        const filePath = path.join(uploadDir, data.storage_name);
        if (fs.existsSync(filePath)) {
          res.type(data.mime_type || 'image/jpeg');
          return res.sendFile(filePath);
        }
      }
    } catch (err) {
      console.warn('[CAMERA] Supabase frame image fetch error:', err.message);
    }
  }

  try {
    const files = await fs.promises.readdir(uploadDir);
    const imageFiles = files.filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
    if (imageFiles.length > 0) {
      const fileStats = await Promise.all(
        imageFiles.map(async (filename) => {
          const filePath = path.join(uploadDir, filename);
          const stat = await fs.promises.stat(filePath);
          return { filename, stat, filePath };
        })
      );
      fileStats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
      const latestFile = fileStats[0];
      const ext = path.extname(latestFile.filename).toLowerCase();
      res.type(ext === '.png' ? 'image/png' : 'image/jpeg');
      return res.sendFile(latestFile.filePath);
    }
  } catch (fallbackErr) {
    console.error('Fallback image read error:', fallbackErr);
  }

  return res.status(404).json({ success: false, error: 'Camera frame image file not found.' });
});



// Primary Combined Risk Evaluation Endpoint
app.post('/api/evaluate-risk', requireUser, (req, res, next) => {
  upload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    try {
      if (!req.file) return res.status(400).json({ success: false, error: 'Image file required.' });
      const aiResult = await analyzeChickenImage(req.file.path, req.file.mimetype);
      const mockSensorData = {
        temperature: parseFloat(req.body.mock_temp) || 30.0,
        humidity: parseFloat(req.body.mock_humidity) || 60.0,
        heatIndex: parseFloat(req.body.mock_heat_index) || 31.0,
        motionLevel: req.body.mock_motion || "LOW",
        aiStressRisk: aiResult.stress_risk
      };
      const riskEvaluation = calculateCombinedStressRisk(mockSensorData);
      const rgbSignal = {
        LOW: { color: "GREEN", red: 0, green: 255, blue: 0 },
        MEDIUM: { color: "YELLOW", red: 255, green: 255, blue: 0 },
        HIGH: { color: "RED", red: 255, green: 0, blue: 0 }
      }[riskEvaluation.finalStressRisk];
      return res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          imageId: req.file.filename,
          sensorInputs: mockSensorData,
          aiResult: aiResult,
          finalAssessment: riskEvaluation,
          hardwareCommand: { rgbIndicator: rgbSignal }
        }
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });
});

// MOUNT COOP-21 ROUTER HERE
app.use('/api', (req, res, next) => {
  if (req.method === 'POST' && req.path === '/monitoring') return requireDevice(req, res, next);
  return requireUser(req, res, next);
}, require('./routes/telemetryRoutes'));

const { startDiscoveryService } = require('./services/discoveryService');

const PORT = process.env.PORT || 5000;
app.listen(PORT, process.env.HOST || '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  startDiscoveryService(PORT);
});