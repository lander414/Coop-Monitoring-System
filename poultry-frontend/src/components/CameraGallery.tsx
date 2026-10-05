import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Images, RefreshCw, X, Calendar, Clock, HardDrive, CheckCircle2, AlertCircle, Eye, Filter } from 'lucide-react';
import type { CameraFrame, TimeRangeFilter } from '../types/monitoring';
import { fetchCameraFrameHistory, resolveFrameImageUrl } from '../services/api';
import RiskAnalysisBadge from './RiskAnalysisBadge';

interface CameraGalleryProps {
  deviceId?: string;
  limit?: number;
}

const FILTER_OPTIONS: { id: TimeRangeFilter; label: string }[] = [
  { id: 'hourly', label: 'Hourly' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'all', label: 'All' },
];

export const CameraGallery: React.FC<CameraGalleryProps> = ({
  deviceId = 'ESP32_COOP_01',
  limit = 24,
}) => {
  const [frames, setFrames] = useState<CameraFrame[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('daily');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<CameraFrame | null>(null);

  const loadGallery = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCameraFrameHistory(deviceId, limit, timeRange);
      setFrames(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch camera gallery');
    } finally {
      setLoading(false);
    }
  }, [deviceId, limit, timeRange]);

  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  const filteredFrames = useMemo(() => {
    if (timeRange === 'all') return frames;
    const now = Date.now();
    const cutoff =
      timeRange === 'hourly'
        ? now - 60 * 60 * 1000
        : timeRange === 'daily'
          ? now - 24 * 60 * 60 * 1000
          : now - 7 * 24 * 60 * 60 * 1000;

    return frames.filter((frame) => {
      const timeStr = frame.captured_at || frame.uploaded_at;
      if (!timeStr) return true;
      const time = new Date(timeStr).getTime();
      return isNaN(time) || time >= cutoff;
    });
  }, [frames, timeRange]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '--';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 flex items-center gap-1.5">
            <Images size={14} className="text-blue-600" /> Historical Camera Gallery
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">Recent Coop Captures</h2>
        </div>

        {/* Controls: Time-Range Filter & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented Filter Pills */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200/80">
            {FILTER_OPTIONS.map((opt) => {
              const isActive = timeRange === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setTimeRange(opt.id)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-100">
            {filteredFrames.length} {filteredFrames.length === 1 ? 'Capture' : 'Captures'}
          </span>

          <button
            onClick={loadGallery}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
            aria-label="Reload frames"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Reload</span>
          </button>
        </div>
      </div>

      {/* Grid or Empty/Error State */}
      {error ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-xl bg-red-50 p-4 text-center text-red-600 border border-red-100">
          <AlertCircle size={24} className="mb-2" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      ) : loading && filteredFrames.length === 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : frames.length === 0 ? (
        <div className="flex h-44 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-400">
          <Images size={32} className="mb-2 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">No frame history available</p>
          <p className="text-xs text-slate-400 mt-1">Frames captured by ESP32-CAM will appear here.</p>
        </div>
      ) : filteredFrames.length === 0 ? (
        <div className="flex h-44 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-400">
          <Filter size={28} className="mb-2 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No photos in the {timeRange} window</p>
          <p className="text-xs text-slate-400 mt-1">
            {timeRange === 'hourly'
              ? 'No captures in the past hour. Switch to Daily or Weekly to inspect earlier frames.'
              : timeRange === 'daily'
                ? 'No captures in the past 24 hours. Switch to Weekly or All.'
                : 'No captures in the past 7 days.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            {FILTER_OPTIONS.filter((opt) => opt.id !== timeRange).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setTimeRange(opt.id)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition shadow-xs"
              >
                View {opt.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {filteredFrames.map((frame) => {
            const url = resolveFrameImageUrl(frame.imageUrl);
            const rawTime = frame.captured_at || frame.uploaded_at;
            const timeLabel = rawTime
              ? (timeRange === 'weekly' || timeRange === 'all'
                  ? new Date(rawTime).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : new Date(rawTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
              : '--';

            return (
              <div
                key={frame.frame_id}
                onClick={() => setSelectedFrame(frame)}
                className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-900 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="aspect-square overflow-hidden bg-slate-950">
                  <img
                    src={url}
                    alt={`Frame ${frame.frame_id}`}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                {/* Hover overlay button */}
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-900 shadow-md backdrop-blur-md">
                    <Eye size={14} /> View Frame
                  </span>
                </div>

                {/* Risk Tag Badge */}
                <div className="absolute top-2 right-2">
                  <RiskAnalysisBadge risk={frame.ai_stress_risk} size="sm" />
                </div>

                {/* Timestamp Footer */}
                <div className="bg-slate-900/90 backdrop-blur-sm p-2 text-[11px] text-slate-300 flex justify-between items-center border-t border-slate-800">
                  <span className="truncate" title={rawTime ? new Date(rawTime).toLocaleString() : ''}>
                    {timeLabel}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">
                    {frame.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Frame Detail Modal */}
      {selectedFrame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Frame Inspection Details</h3>
                <p className="text-xs text-slate-500 font-mono">ID: {selectedFrame.frame_id}</p>
              </div>
              <button
                onClick={() => setSelectedFrame(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Full Image */}
              <div className="overflow-hidden rounded-xl bg-slate-950 border border-slate-200 flex items-center justify-center">
                <img
                  src={resolveFrameImageUrl(selectedFrame.imageUrl)}
                  alt="Expanded coop frame"
                  className="max-h-80 w-full object-contain"
                />
              </div>

              {/* Information Panel */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    AI Stress Assessment
                  </label>
                  <div className="mt-1.5">
                    <RiskAnalysisBadge
                      risk={selectedFrame.ai_stress_risk}
                      confidence={selectedFrame.ai_confidence}
                      indicators={selectedFrame.ai_indicators}
                      showConfidence
                      showIndicators
                      size="md"
                    />
                  </div>
                </div>

                {selectedFrame.ai_description && (
                  <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700 border border-slate-200">
                    <span className="font-semibold block mb-1">AI Description:</span>
                    {selectedFrame.ai_description}
                  </div>
                )}

                <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Calendar size={13} /> Captured Time
                    </span>
                    <span className="font-medium">
                      {selectedFrame.captured_at
                        ? new Date(selectedFrame.captured_at).toLocaleString()
                        : new Date(selectedFrame.uploaded_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Clock size={13} /> Uploaded Time
                    </span>
                    <span className="font-medium">
                      {new Date(selectedFrame.uploaded_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <HardDrive size={13} /> Size / Format
                    </span>
                    <span className="font-medium">
                      {formatFileSize(selectedFrame.size_in_bytes)} ({selectedFrame.mime_type})
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <CheckCircle2 size={13} /> Processing Status
                    </span>
                    <span className="font-semibold capitalize text-emerald-600">
                      {selectedFrame.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraGallery;
