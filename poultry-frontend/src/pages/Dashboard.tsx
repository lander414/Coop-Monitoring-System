import { useState, useEffect } from 'react';
import { fetchLatestTelemetry } from '../services/api';
import type { TelemetryLog } from '../types/monitoring';
import { Activity, ShieldCheck, Thermometer, Droplets, Wind, RefreshCw } from 'lucide-react';

export default function Dashboard() {
  const [latest, setLatest] = useState<TelemetryLog | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchLatestTelemetry();
      setLatest(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch telemetry');
      setLatest(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const getRiskBadge = (risk?: string) => {
    switch (risk) {
      case 'HIGH': return { bg: 'bg-red-100 text-red-800 border-red-300', label: 'HIGH DISTRESS RISK' };
      case 'MEDIUM': return { bg: 'bg-amber-100 text-amber-800 border-amber-300', label: 'MODERATE STRESS' };
      case 'LOW': return { bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: 'COMFORTABLE / LOW' };
      default: return { bg: 'bg-slate-100 text-slate-700 border-slate-300', label: 'NORMAL / NONE' };
    }
  };

  const badge = getRiskBadge(latest?.stress_risk);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <header className="max-w-7xl mx-auto mb-8 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="text-blue-600" /> Poultry Environmental & Stress Dashboard
          </h1>
          <p className="text-sm text-slate-500">Device ID: {latest?.device_id || 'ESP32_COOP_01'}</p>
        </div>
        <button 
          onClick={loadData} 
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </header>

      {error && (
        <div className="max-w-7xl mx-auto mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !latest && (
        <div className="max-w-7xl mx-auto mb-4 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
          Loading latest telemetry...
        </div>
      )}

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CURRENT STATUS CARD (COOP-23 / Current Status) */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center justify-between">
          <div>
            <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Current Status</span>
            <div className="my-6 w-32 h-32 mx-auto bg-amber-50 rounded-full flex items-center justify-center border-4 border-amber-100 shadow-inner">
              {/* Placeholder vector representation for chicken states */}
              <span className="text-4xl">🐔</span>
            </div>
            <div className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold border ${badge.bg}`}>
              {badge.label}
            </div>
            <p className="text-sm text-slate-600 mt-4 px-4">
              {latest?.stress_risk === 'HIGH' ? 'Severe conditions detected. Immediate climate intervention recommended.' : 
               latest?.stress_risk === 'MEDIUM' ? 'Environmental parameters showing elevated heat index metrics.' :
               'Coop conditions are stable and within optimal comfort zones.'}
            </p>
          </div>
          <div className="text-xs text-slate-400 mt-6 border-t pt-4 w-full">
            Last Assessment: {latest?.created_at ? new Date(latest.created_at).toLocaleTimeString() : 'N/A'}
          </div>
        </div>

        {/* ENVIRONMENT METRICS & STATS (COOP-23 Cards) */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Temperature</p>
              <h3 className="text-3xl font-bold mt-1 text-slate-800">{latest?.temperature ?? '--'}°C</h3>
            </div>
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
              <Thermometer size={28} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Humidity</p>
              <h3 className="text-3xl font-bold mt-1 text-slate-800">{latest?.humidity ?? '--'}%</h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Droplets size={28} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Heat Index</p>
              <h3 className="text-3xl font-bold mt-1 text-slate-800">{latest?.heat_index ?? '--'}°C</h3>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <Wind size={28} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Motion Sensor</p>
              <h3 className="text-lg font-bold mt-1 text-slate-600">
                {latest?.chicken_present === null || latest?.chicken_present === undefined 
                  ? 'Sensor Unavailable' 
                  : latest.chicken_present ? 'Activity Detected' : 'No Activity'}
              </h3>
            </div>
            <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
              <ShieldCheck size={28} />
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}