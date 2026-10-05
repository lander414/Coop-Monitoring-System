import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, Clock3, Droplets, LogOut, RefreshCw, Settings, ShieldCheck, Thermometer, Wind, XCircle } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchLatestTelemetry, fetchTelemetryHistory } from '../services/api';
import ChickenStatusAnimation from '../components/ChickenStatusAnimation';
import LiveSnapshotCard from '../components/LiveSnapshotCard';
import CameraGallery from '../components/CameraGallery';
import FlockComfortSuggestions from '../components/FlockComfortSuggestions';
import type { StressRiskLevel, TelemetryLog, TimeRangeFilter } from '../types/monitoring';
import { useAuth } from '../context/AuthContext';

const riskStyles: Record<StressRiskLevel, { label: string; badge: string; accent: string }> = {
  NONE: { label: 'No flock detected', badge: 'bg-slate-100 text-slate-700 border-slate-200', accent: 'text-slate-600' },
  LOW: { label: 'Comfortable', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', accent: 'text-emerald-600' },
  MEDIUM: { label: 'Moderate stress', badge: 'bg-amber-50 text-amber-700 border-amber-200', accent: 'text-amber-600' },
  HIGH: { label: 'High distress risk', badge: 'bg-red-50 text-red-700 border-red-200', accent: 'text-red-600' },
};

function RiskBadge({ risk }: { risk: StressRiskLevel }) {
  const style = riskStyles[risk];
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${style.badge}`}>{style.label}</span>;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const settingsRef = useRef<HTMLDivElement>(null);
  const [latest, setLatest] = useState<TelemetryLog | null>(null);
  const [history, setHistory] = useState<TelemetryLog[]>([]);
  const [chartRange, setChartRange] = useState<TimeRangeFilter>('hourly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [esp32Network, setEsp32Network] = useState(() => localStorage.getItem('esp32_network') || 'Coop Wi-Fi');
  const [esp32Address, setEsp32Address] = useState(() => localStorage.getItem('esp32_address') || 'ESP32_CAM_01');

  useEffect(() => {
    const closeSettings = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) setSettingsOpen(false);
    };
    document.addEventListener('mousedown', closeSettings);
    return () => document.removeEventListener('mousedown', closeSettings);
  }, []);

  const saveEsp32Settings = () => {
    localStorage.setItem('esp32_network', esp32Network);
    localStorage.setItem('esp32_address', esp32Address);
    setSettingsOpen(false);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const limit = chartRange === 'hourly' ? 60 : chartRange === 'daily' ? 150 : 300;
      const [latestData, historyData] = await Promise.all([
        fetchLatestTelemetry(),
        fetchTelemetryHistory(limit, chartRange)
      ]);
      setLatest(latestData);
      setHistory([...historyData].reverse());
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch telemetry');
    } finally {
      setLoading(false);
    }
  }, [chartRange]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);


  const chartData = useMemo(() => history.map((reading) => {
    let formattedTime = '--';
    if (reading.created_at) {
      const date = new Date(reading.created_at);
      if (chartRange === 'hourly') {
        formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (chartRange === 'daily') {
        formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (chartRange === 'weekly') {
        formattedTime = date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
      } else {
        formattedTime = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    }

    return {
      time: formattedTime,
      fullTime: reading.created_at ? new Date(reading.created_at).toLocaleString() : '--',
      temperature: reading.temperature,
      humidity: reading.humidity,
      heatIndex: reading.heat_index,
    };
  }), [history, chartRange]);

  const statistics = useMemo(() => {
    if (!history.length) return { averageTemperature: '--', averageHumidity: '--', highRiskReadings: 0 };
    const average = (values: number[]) => (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);
    return {
      averageTemperature: average(history.map((reading) => reading.temperature)),
      averageHumidity: average(history.map((reading) => reading.humidity)),
      highRiskReadings: history.filter((reading) => reading.stress_risk === 'HIGH').length,
    };
  }, [history]);

  const currentRisk = latest?.stress_risk || 'NONE';
  const recommendation = currentRisk === 'HIGH'
    ? 'Improve ventilation and inspect the flock now.'
    : currentRisk === 'MEDIUM'
      ? 'Watch heat index and increase airflow.'
      : latest?.chicken_present === false
        ? 'Check the motion sensor or coop feed.'
        : 'Conditions are comfortable.';


  return (
    <div className="dashboard-shell min-h-screen bg-slate-50 p-4 text-slate-800 sm:p-6">
      <header className="dashboard-header mx-auto mb-6 flex max-w-7xl flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="dashboard-header-copy"><p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-600">COOP MONITORING</p><h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Activity className="text-blue-600" /> Poultry Command Center</h1><p className="mt-1 text-sm text-slate-500">{latest?.device_id || esp32Address}</p></div>
        <div className="dashboard-header-actions">
          <span className="dashboard-user">{user?.email}</span>
          <button onClick={loadData} className="dashboard-refresh flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200" aria-label="Refresh telemetry"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh</button>
          <div className="dashboard-settings" ref={settingsRef}>
            <button onClick={() => setSettingsOpen((open) => !open)} className="dashboard-settings-button" aria-label="Open dashboard settings" aria-expanded={settingsOpen}><Settings size={18} /></button>
            {settingsOpen && <div className="dashboard-settings-menu">
              <div className="settings-menu-heading"><strong>Coop connection</strong><span>ESP32</span></div>
              <label htmlFor="esp32-network">Wi-Fi network<input id="esp32-network" value={esp32Network} onChange={(event) => setEsp32Network(event.target.value)} placeholder="Network name" /></label>
              <label htmlFor="esp32-address">Device ID<input id="esp32-address" value={esp32Address} onChange={(event) => setEsp32Address(event.target.value)} placeholder="ESP32_COOP_01" /></label>
              <button className="settings-save" onClick={saveEsp32Settings}>Save connection</button>
              <button className="settings-signout" onClick={() => void signOut()}><LogOut size={15} /> Sign out</button>
            </div>}
          </div>
        </div>
      </header>

      {error && <div className="mx-auto mb-4 flex max-w-7xl items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><XCircle size={17} /> {error}</div>}

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1" aria-labelledby="status-heading"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Chicken Status</p><Clock3 size={18} className="text-slate-400" /></div><div className="my-5 flex h-40 items-center justify-center rounded-2xl bg-amber-50"><ChickenStatusAnimation chickenPresent={latest?.chicken_present} stressRisk={currentRisk} /></div><h2 id="status-heading" className="text-xl font-bold">{latest?.chicken_present === null || latest?.chicken_present === undefined ? 'Sensor unavailable' : latest.chicken_present ? 'Activity detected' : 'No activity detected'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{recommendation}</p><div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-400">Last assessment: {latest?.created_at ? new Date(latest.created_at).toLocaleString() : 'Waiting for telemetry'}</div></section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2" aria-labelledby="environment-heading"><div className="sm:col-span-2"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Current Environment</p><h2 id="environment-heading" className="mt-1 text-2xl font-bold">Coop conditions at a glance</h2></div><div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div><p className="text-sm font-medium text-slate-500">Temperature</p><p className="mt-1 text-3xl font-bold">{latest?.temperature ?? '--'}<span className="ml-1 text-lg font-medium text-slate-400">°C</span></p></div><div className="rounded-xl bg-orange-50 p-3 text-orange-600"><Thermometer size={26} /></div></div><div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div><p className="text-sm font-medium text-slate-500">Humidity</p><p className="mt-1 text-3xl font-bold">{latest?.humidity ?? '--'}<span className="ml-1 text-lg font-medium text-slate-400">%</span></p></div><div className="rounded-xl bg-blue-50 p-3 text-blue-600"><Droplets size={26} /></div></div><div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div><p className="text-sm font-medium text-slate-500">Heat Index</p><p className="mt-1 text-3xl font-bold">{latest?.heat_index ?? '--'}<span className="ml-1 text-lg font-medium text-slate-400">°C</span></p></div><div className="rounded-xl bg-purple-50 p-3 text-purple-600"><Wind size={26} /></div></div><div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div><p className="text-sm font-medium text-slate-500">Motion Sensor</p><p className="mt-1 text-xl font-bold text-slate-600">{latest?.chicken_present === undefined || latest.chicken_present === null ? 'Unavailable' : latest.chicken_present ? 'Active' : 'Quiet'}</p></div><div className="rounded-xl bg-slate-100 p-3 text-slate-600"><ShieldCheck size={26} /></div></div></section>

        {/* Live ESP32-CAM Snapshot Card */}
        <section className="lg:col-span-1">
          <LiveSnapshotCard deviceId={esp32Address} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2" aria-labelledby="history-heading">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Historical Data</p>
              <h2 id="history-heading" className="mt-1 text-xl font-bold tracking-tight">Environmental trend</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Segmented Filter Pills */}
              <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200/80">
                {(['hourly', 'daily', 'weekly'] as const).map((r) => {
                  const isActive = chartRange === r;
                  const label = r.charAt(0).toUpperCase() + r.slice(1);
                  return (
                    <button
                      key={r}
                      onClick={() => setChartRange(r)}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-100">
                {history.length} readings
              </span>
            </div>
          </div>
          <div className="h-64 w-full">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={28} />
                  <YAxis tick={{ fontSize: 11 }} width={32} />
                  <Tooltip
                    labelFormatter={(_, payload) => {
                      if (payload && payload[0]?.payload?.fullTime) {
                        return payload[0].payload.fullTime;
                      }
                      return '';
                    }}
                  />
                  <Line type="monotone" dataKey="temperature" stroke="#f97316" strokeWidth={2} dot={false} name="Temperature" />
                  <Line type="monotone" dataKey="heatIndex" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Heat index" />
                  <Line type="monotone" dataKey="humidity" stroke="#2563eb" strokeWidth={2} dot={false} name="Humidity" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-sm text-slate-400">
                <p>No historical readings found for the {chartRange} filter.</p>
              </div>
            )}
          </div>
        </section>

        {/* Column 1: Stress Status & Statistics */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="stress-heading">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Stress Status</p>
            <h2 id="stress-heading" className="mt-2 text-xl font-bold">Current assessment</h2>
            <div className="mt-5"><RiskBadge risk={currentRisk} /></div>
            <div className="mt-5 flex items-center gap-3">
              <AlertTriangle className={riskStyles[currentRisk].accent} />
              <p className="text-sm leading-6 text-slate-600">{recommendation}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="statistics-heading">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Statistics</p>
            <h2 id="statistics-heading" className="mt-2 text-xl font-bold">
              {chartRange.charAt(0).toUpperCase() + chartRange.slice(1)} snapshot
            </h2>
            <div className="mt-5 space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Average temperature</span>
                <strong>{statistics.averageTemperature}°C</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Average humidity</span>
                <strong>{statistics.averageHumidity}%</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">High-risk readings</span>
                <strong className="text-red-600">{statistics.highRiskReadings}</strong>
              </div>
            </div>
          </section>
        </div>

        {/* Columns 2-3: Flock Comfort Suggestions */}
        <div className="lg:col-span-2">
          <FlockComfortSuggestions latest={latest} />
        </div>

        {/* Historical Camera Gallery Section */}
        <section className="lg:col-span-3">
          <CameraGallery deviceId={esp32Address} limit={24} />
        </section>
      </main>
    </div>
  );
}

