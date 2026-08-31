const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase Client
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.warn('Warning: Missing Supabase environment variables in .env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Helper Functions for Telemetry
function calculateHeatIndex(temp, hum) {
  return temp + 0.55 * (1 - hum / 100) * (temp - 14.5);
}

function determineStressRisk(heatIndex, isChickenPresent) {
  if (!isChickenPresent) return 'NONE'; // Short-circuit rule
  if (heatIndex >= 32) return 'HIGH';
  if (heatIndex >= 27) return 'MEDIUM';
  return 'LOW';
}

// 1. Receive ESP32/Sensor Data & AI Results + Store in Supabase
router.post('/monitoring', async (req, res) => {
  try {
    const { device_id = 'ESP32_COOP_01', temperature, humidity, chicken_present } = req.body;

    if (temperature === undefined || humidity === undefined || chicken_present === undefined) {
      return res.status(400).json({ success: false, error: 'Missing temperature, humidity, or chicken_present.' });
    }

    const heatIndex = parseFloat(calculateHeatIndex(temperature, humidity).toFixed(1));
    const stressRisk = determineStressRisk(heatIndex, chicken_present);

    const payload = {
      device_id,
      temperature,
      humidity,
      heat_index: heatIndex,
      chicken_present,
      stress_risk: stressRisk,
    };

    const { data, error } = await supabase
      .from('telemetry_logs')
      .insert([payload])
      .select();

    if (error) {
      console.error('Supabase Error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.status(201).json({
      success: true,
      message: 'Monitoring telemetry stored successfully',
      data: data[0]
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Retrieve Latest Readings
router.get('/monitoring/latest', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('telemetry_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Retrieve Historical Records
router.get('/monitoring/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    const { data, error } = await supabase
      .from('telemetry_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return res.status(500).json({ success: false, error: error.message });

    return res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;