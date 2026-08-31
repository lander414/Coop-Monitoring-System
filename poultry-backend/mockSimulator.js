require('dotenv').config(); // Loads variables from .env
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL; 
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY; 

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('Missing Supabase environment variables in .env!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

function calculateHeatIndex(temp, hum) {
  return temp + 0.55 * (1 - hum / 100) * (temp - 14.5);
}

function determineStressRisk(heatIndex, isChickenPresent) {
  if (!isChickenPresent) return 'NONE'; 
  if (heatIndex >= 32) return 'HIGH';
  if (heatIndex >= 27) return 'MEDIUM';
  return 'LOW';
}

async function sendMockTelemetry() {
  const temperature = parseFloat((Math.random() * (36 - 22) + 22).toFixed(1)); 
  const humidity = parseFloat((Math.random() * (85 - 45) + 45).toFixed(1));    
  const chickenPresent = Math.random() > 0.25;                                 

  const heatIndex = parseFloat(calculateHeatIndex(temperature, humidity).toFixed(1));
  const stressRisk = determineStressRisk(heatIndex, chickenPresent);

  const payload = {
    device_id: 'ESP32_COOP_01',
    temperature,
    humidity,
    heat_index: heatIndex,
    chicken_present: chickenPresent,
    stress_risk: stressRisk,
  };

  const { error } = await supabase.from('telemetry_logs').insert([payload]);

  if (error) {
    console.error('Error inserting mock data:', error.message);
  } else {
    console.log(`[${new Date().toLocaleTimeString()}] Sent:`, payload);
  }
}

console.log('Starting Supabase Mock Telemetry Simulator...');
setInterval(sendMockTelemetry, 5000);