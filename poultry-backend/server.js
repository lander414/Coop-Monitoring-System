const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

const { analyzeChickenImage } = require('./services/aiService');
const { calculateCombinedStressRisk } = require('./services/riskEngine');

const app = express();
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Storage configuration with unique timestamp naming
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
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
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
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
app.post('/api/images', (req, res, next) => {
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

// Primary Combined Risk Evaluation Endpoint
app.post('/api/evaluate-risk', (req, res, next) => {
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
app.use('/api', require('./routes/telemetryRoutes'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, '127.0.0.1', () => console.log(`Server running on http://127.0.0.1:${PORT}`));