import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock3, CloudUpload, Droplets, Image as ImageIcon, RefreshCw, ShieldCheck, Thermometer, Wind, XCircle } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { evaluateChickenImage, fetchLatestTelemetry, fetchTelemetryHistory } from '../services/api';
import ChickenStatusAnimation from '../components/ChickenStatusAnimation';
import type { EvaluationResponse, StressRiskLevel, TelemetryLog } from '../types/monitoring';

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
  const [latest, setLatest] = useState<TelemetryLog | null>(null);
  const [history, setHistory] = useState<TelemetryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [latestData, historyData] = await Promise.all([fetchLatestTelemetry(), fetchTelemetryHistory(50)]);
      setLatest(latestData);
      setHistory([...historyData].reverse());
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const chartData = useMemo(() => history.map((reading) => ({
    time: reading.created_at ? new Date(reading.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
    temperature: reading.temperature,
    humidity: reading.humidity,
    heatIndex: reading.heat_index,
  })), [history]);

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
    ? 'Immediate intervention recommended. Improve ventilation and inspect the flock.'
    : currentRisk === 'MEDIUM'
      ? 'Monitor heat index closely and consider increasing airflow.'
      : latest?.chicken_present === false
        ? 'No chicken activity detected. Check the motion sensor or coop feed.'
        : 'Environmental conditions are within the comfortable operating range.';

  const handleImageChange = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setEvaluation(null);
    setEvaluationError(null);
  };

  const handleEvaluate = async () => {
    if (!selectedImage) return;
    const formData = new FormData();
    formData.append('image', selectedImage);
    formData.append('mock_temp', String(latest?.temperature ?? 30));
    formData.append('mock_humidity', String(latest?.humidity ?? 60));
    formData.append('mock_heat_index', String(latest?.heat_index ?? 31));
    formData.append('mock_motion', latest?.chicken_present ? 'HIGH' : 'LOW');
    try {
      setEvaluating(true);
      setEvaluationError(null);
      setEvaluation(await evaluateChickenImage(formData));
    } catch (err: unknown) {
      setEvaluationError(err instanceof Error ? err.message : 'Image evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-800 sm:p-6">
      <header className="mx-auto mb-6 flex max-w-7xl flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div><p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-600">COOP-4 / Web Dashboard</p><h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Activity className="text-blue-600" /> Poultry Command Center</h1><p className="mt-1 text-sm text-slate-500">Live environmental monitoring for {latest?.device_id || 'ESP32_COOP_01'}</p></div>
        <button onClick={loadData} className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200" aria-label="Refresh telemetry"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </header>

      {error && <div className="mx-auto mb-4 flex max-w-7xl items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><XCircle size={17} /> {error}</div>}

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1" aria-labelledby="status-heading"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Chicken Status</p><Clock3 size={18} className="text-slate-400" /></div><div className="my-5 flex h-40 items-center justify-center rounded-2xl bg-amber-50"><ChickenStatusAnimation chickenPresent={latest?.chicken_present} stressRisk={currentRisk} /></div><h2 id="status-heading" className="text-xl font-bold">{latest?.chicken_present === null || latest?.chicken_present === undefined ? 'Sensor unavailable' : latest.chicken_present ? 'Activity detected' : 'No activity detected'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{recommendation}</p><div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-400">Last assessment: {latest?.created_at ? new Date(latest.created_at).toLocaleString() : 'Waiting for telemetry'}</div></section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2" aria-labelledby="environment-heading"><div className="sm:col-span-2"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Current Environment</p><h2 id="environment-heading" className="mt-1 text-2xl font-bold">Coop conditions at a glance</h2></div><div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div><p className="text-sm font-medium text-slate-500">Temperature</p><p className="mt-1 text-3xl font-bold">{latest?.temperature ?? '--'}<span className="ml-1 text-lg font-medium text-slate-400">°C</span></p></div><div className="rounded-xl bg-orange-50 p-3 text-orange-600"><Thermometer size={26} /></div></div><div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div><p className="text-sm font-medium text-slate-500">Humidity</p><p className="mt-1 text-3xl font-bold">{latest?.humidity ?? '--'}<span className="ml-1 text-lg font-medium text-slate-400">%</span></p></div><div className="rounded-xl bg-blue-50 p-3 text-blue-600"><Droplets size={26} /></div></div><div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div><p className="text-sm font-medium text-slate-500">Heat Index</p><p className="mt-1 text-3xl font-bold">{latest?.heat_index ?? '--'}<span className="ml-1 text-lg font-medium text-slate-400">°C</span></p></div><div className="rounded-xl bg-purple-50 p-3 text-purple-600"><Wind size={26} /></div></div><div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div><p className="text-sm font-medium text-slate-500">Motion Sensor</p><p className="mt-1 text-xl font-bold text-slate-600">{latest?.chicken_present === undefined || latest.chicken_present === null ? 'Unavailable' : latest.chicken_present ? 'Active' : 'Quiet'}</p></div><div className="rounded-xl bg-slate-100 p-3 text-slate-600"><ShieldCheck size={26} /></div></div></section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2" aria-labelledby="history-heading"><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Historical Data</p><h2 id="history-heading" className="mt-1 text-xl font-bold">Environmental trend</h2></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Last {history.length} readings</span></div><div className="h-64 w-full">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={28} /><YAxis tick={{ fontSize: 11 }} width={32} /><Tooltip /><Line type="monotone" dataKey="temperature" stroke="#f97316" strokeWidth={2} dot={false} name="Temperature" /><Line type="monotone" dataKey="heatIndex" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Heat index" /><Line type="monotone" dataKey="humidity" stroke="#2563eb" strokeWidth={2} dot={false} name="Humidity" /></LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-slate-400">Historical readings will appear here.</div>}</div></section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="stress-heading"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Stress Status</p><h2 id="stress-heading" className="mt-2 text-xl font-bold">Current assessment</h2><div className="mt-5"><RiskBadge risk={currentRisk} /></div><div className="mt-5 flex items-center gap-3"><AlertTriangle className={riskStyles[currentRisk].accent} /><p className="text-sm leading-6 text-slate-600">{recommendation}</p></div></section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1" aria-labelledby="statistics-heading"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Statistics</p><h2 id="statistics-heading" className="mt-2 text-xl font-bold">Session snapshot</h2><div className="mt-5 space-y-4 text-sm"><div className="flex justify-between"><span className="text-slate-500">Average temperature</span><strong>{statistics.averageTemperature}°C</strong></div><div className="flex justify-between"><span className="text-slate-500">Average humidity</span><strong>{statistics.averageHumidity}%</strong></div><div className="flex justify-between"><span className="text-slate-500">High-risk readings</span><strong className="text-red-600">{statistics.highRiskReadings}</strong></div></div></section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2" aria-labelledby="image-heading"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Latest Image</p><h2 id="image-heading" className="mt-1 text-xl font-bold">Visual flock check</h2></div><ImageIcon className="text-slate-400" /></div><div className="mt-5 grid gap-5 md:grid-cols-[180px_1fr]">{previewUrl ? <img src={previewUrl} alt="Selected chicken for evaluation" className="h-36 w-full rounded-xl object-cover" /> : <label className="flex h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-500 hover:border-blue-400"><CloudUpload className="mb-2 text-blue-500" /><span>Choose a chicken image</span><input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(event) => handleImageChange(event.target.files?.[0])} /></label>}<div><p className="text-sm text-slate-500">Upload a recent coop image to compare visual signs with environmental readings.</p><button onClick={handleEvaluate} disabled={!selectedImage || evaluating} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{evaluating ? 'Evaluating...' : 'Evaluate image'}</button>{evaluationError && <p className="mt-3 text-sm text-red-600">{evaluationError}</p>}{evaluation && <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 size={17} className="text-emerald-600" /> AI result: {evaluation.aiResult.stress_risk}</div><p className="mt-2 text-slate-600">Confidence: {(evaluation.aiResult.confidence * 100).toFixed(0)}% · {evaluation.aiResult.description}</p><p className="mt-2 font-medium">Final assessment: {evaluation.finalAssessment.finalStressRisk}</p></div>}</div></div></section>
      </main>
    </div>
  );
}
