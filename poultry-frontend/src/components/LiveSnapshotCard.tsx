import React, { useEffect, useState, useCallback } from 'react';
import { Camera, RefreshCw, AlertCircle, Cpu, Clock, CheckCircle2, Loader2, Image as ImageIcon } from 'lucide-react';
import type { CameraFrame } from '../types/monitoring';
import { fetchLatestCameraFrame, resolveFrameImageUrl } from '../services/api';
import { supabase } from '../lib/supabase';
import RiskAnalysisBadge from './RiskAnalysisBadge';

interface LiveSnapshotCardProps {
  deviceId?: string;
  onFrameUpdate?: (frame: CameraFrame | null) => void;
}

export const LiveSnapshotCard: React.FC<LiveSnapshotCardProps> = ({
  deviceId = 'ESP32_COOP_01',
  onFrameUpdate,
}) => {
  const [frame, setFrame] = useState<CameraFrame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const loadLatestFrame = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const latest = await fetchLatestCameraFrame(deviceId);
      setFrame(latest);
      if (onFrameUpdate) onFrameUpdate(latest);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load latest snapshot');
    } finally {
      setLoading(false);
    }
  }, [deviceId, onFrameUpdate]);

  useEffect(() => {
    loadLatestFrame();
  }, [loadLatestFrame]);

  // Supabase Realtime Subscription
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`camera_frames_${deviceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'camera_frames',
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object') {
            const newFrame = payload.new as CameraFrame;
            const updatedFrame: CameraFrame = {
              ...newFrame,
              imageUrl: `/api/devices/${deviceId}/frames/${newFrame.frame_id}/image`,
            };
            setFrame(updatedFrame);
            setImageLoaded(false);
            if (onFrameUpdate) onFrameUpdate(updatedFrame);
          }
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [deviceId, onFrameUpdate]);

  const imageUrl = frame?.imageUrl ? resolveFrameImageUrl(frame.imageUrl) : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 flex items-center gap-1.5">
            <Camera size={14} /> Live ESP32-CAM Snapshot
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">Real-Time Coop Vision</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadLatestFrame}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            title="Refresh Snapshot"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Content View */}
      {error ? (
        <div className="flex h-52 flex-col items-center justify-center rounded-xl bg-red-50 p-4 text-center text-red-600 border border-red-100">
          <AlertCircle size={28} className="mb-2" />
          <p className="text-sm font-semibold">{error}</p>
          <button
            onClick={loadLatestFrame}
            className="mt-3 rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 transition"
          >
            Retry Connection
          </button>
        </div>
      ) : frame && imageUrl ? (
        <div className="space-y-4">
          {/* Image Display */}
          <div className="relative overflow-hidden rounded-xl bg-slate-950 aspect-video flex items-center justify-center border border-slate-200 group">
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-slate-400">
                <Loader2 size={24} className="animate-spin text-blue-600" />
              </div>
            )}
            <img
              src={imageUrl}
              alt={`ESP32-CAM frame ${frame.frame_id}`}
              onLoad={() => setImageLoaded(true)}
              className={`h-full w-full object-cover transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
            {/* Live Indicator overlay */}
            <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-slate-900/80 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-white border border-white/10">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE FEED</span>
            </div>
            {/* Status Badge overlay */}
            <div className="absolute bottom-3 right-3 rounded-md bg-slate-900/80 backdrop-blur-md px-2.5 py-1 text-[11px] font-medium text-slate-200 border border-white/10 flex items-center gap-1.5">
              {frame.status === 'completed' ? (
                <CheckCircle2 size={13} className="text-emerald-400" />
              ) : frame.status === 'processing' ? (
                <Loader2 size={13} className="animate-spin text-amber-400" />
              ) : (
                <Clock size={13} className="text-slate-400" />
              )}
              <span className="capitalize">{frame.status}</span>
            </div>
          </div>

          {/* AI Risk Assessment */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                AI Stress Risk Evaluation
              </span>
              <RiskAnalysisBadge
                risk={frame.ai_stress_risk}
                confidence={frame.ai_confidence}
                showConfidence
                size="sm"
              />
            </div>

            {frame.ai_description && (
              <p className="text-xs leading-5 text-slate-600 border-t border-slate-200/60 pt-2 font-medium">
                {frame.ai_description}
              </p>
            )}

            {frame.ai_indicators && frame.ai_indicators.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {frame.ai_indicators.map((indicator, idx) => (
                  <span
                    key={idx}
                    className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 shadow-2xs"
                  >
                    {indicator}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Frame Meta Details */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {frame.captured_at
                ? new Date(frame.captured_at).toLocaleString()
                : new Date(frame.uploaded_at).toLocaleString()}
            </span>
            {frame.sequence_id && (
              <span className="flex items-center gap-1 font-mono">
                <Cpu size={12} />
                Seq: #{frame.sequence_id}
              </span>
            )}
          </div>
        </div>
      ) : (
        /* Empty / No Frame state */
        <div className="flex h-56 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-400">
          <ImageIcon size={36} className="mb-2 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">No ESP32-CAM frame captured yet</p>
          <p className="mt-1 text-xs text-slate-400 max-w-xs">
            Frames uploaded by your microcontroller will sync live automatically.
          </p>
        </div>
      )}
    </div>
  );
};

export default LiveSnapshotCard;
