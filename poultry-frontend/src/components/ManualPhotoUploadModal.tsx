import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Eye,
  Camera,
  RefreshCw,
  FileImage,
  ArrowRight
} from 'lucide-react';
import type { CameraFrame, AIAnalysisResult } from '../types/monitoring';
import { uploadAndAnalyzePhoto } from '../services/api';
import RiskAnalysisBadge from './RiskAnalysisBadge';

interface ManualPhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId?: string;
  onAnalysisComplete?: (frame: CameraFrame, result: AIAnalysisResult) => void;
}

export const ManualPhotoUploadModal: React.FC<ManualPhotoUploadModalProps> = ({
  isOpen,
  onClose,
  deviceId = 'ESP32_COOP_01',
  onAnalysisComplete,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{
    frame: CameraFrame;
    aiResult: AIAnalysisResult;
  } | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setAnalyzing(false);
    setAnalysisStep('');
    setError(null);
    setAnalysisResult(null);
    setCompletedSteps({});
  }, [previewUrl]);

  const handleModalClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPEG or PNG).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('Image file size must be under 15 MB.');
      return;
    }

    setError(null);
    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    try {
      setAnalyzing(true);
      setError(null);
      setAnalysisStep('Uploading image to coop server...');

      setTimeout(() => {
        setAnalysisStep('Consulting Gemini AI vision model...');
      }, 700);

      setTimeout(() => {
        setAnalysisStep('Evaluating stress indicators & behavioral cues...');
      }, 1600);

      setTimeout(() => {
        setAnalysisStep('Synthesizing expert caretaker recommendations...');
      }, 2400);

      const result = await uploadAndAnalyzePhoto(selectedFile, deviceId);
      setAnalysisResult(result);

      if (onAnalysisComplete) {
        onAnalysisComplete(result.frame, result.aiResult);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Photo analysis failed. Please try again.');
    } finally {
      setAnalyzing(false);
      setAnalysisStep('');
    }
  };

  const toggleStep = (idx: number) => {
    setCompletedSteps((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  if (!isOpen) return null;

  const suggestions = analysisResult?.aiResult?.suggestions || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Camera size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Manual Coop Photo Inspection
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 border border-indigo-100">
                  <Sparkles size={11} /> AI Powered
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Upload a flock photo to evaluate heat stress indicators and receive actionable instructions
              </p>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-600" />
              <div>
                <strong className="block font-semibold">Upload Analysis Failed</strong>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {!analysisResult ? (
            /* Upload Screen */
            <div className="space-y-5">
              {!previewUrl ? (
                /* Drag & Drop Area */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/50'
                      : 'border-slate-300 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/30'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/jpg"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm border border-slate-200 group-hover:scale-105 transition-transform">
                    <Upload size={26} />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-slate-800">
                    Click to select photo or drag and drop
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Supports high-resolution JPEG and PNG photos (up to 15MB)
                  </p>
                  <div className="mt-4 flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-emerald-500" /> Auto Flock Detection
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-emerald-500" /> Heat Stress Scoring
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-emerald-500" /> Action Checklist
                    </span>
                  </div>
                </div>
              ) : (
                /* Preview Area */
                <div className="space-y-4">
                  <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 flex items-center justify-center max-h-72">
                    <img
                      src={previewUrl}
                      alt="Selected coop preview"
                      className="max-h-72 w-full object-contain"
                    />
                    <button
                      onClick={resetState}
                      disabled={analyzing}
                      className="absolute top-3 right-3 rounded-full bg-slate-900/80 p-2 text-white hover:bg-slate-900 transition backdrop-blur-xs disabled:opacity-50"
                      title="Change image"
                    >
                      <X size={16} />
                    </button>
                    <div className="absolute bottom-3 left-3 rounded-lg bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-xs flex items-center gap-1.5">
                      <FileImage size={13} />
                      <span className="max-w-[200px] truncate">{selectedFile?.name}</span>
                      <span className="text-slate-400">
                        ({((selectedFile?.size || 0) / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                  </div>

                  {analyzing ? (
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 text-center space-y-3">
                      <div className="flex items-center justify-center gap-2 text-blue-700">
                        <RefreshCw size={18} className="animate-spin" />
                        <span className="text-sm font-semibold">{analysisStep || 'Analyzing photo...'}</span>
                      </div>
                      <p className="text-xs text-blue-600/80">
                        Google Gemini Vision is examining bird postures, panting indications, and heat behaviors.
                      </p>
                      <div className="h-1.5 w-full bg-blue-200/60 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full animate-pulse w-3/4 mx-auto" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3 pt-2">
                      <button
                        type="button"
                        onClick={resetState}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        Choose Different Photo
                      </button>
                      <button
                        type="button"
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50"
                      >
                        <Sparkles size={14} />
                        <span>Inspect & Generate Care Instructions</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Results & Suggestive Instructions Screen */
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Photo & Stress Overview Grid */}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="overflow-hidden rounded-2xl bg-slate-950 border border-slate-200 flex items-center justify-center max-h-64">
                  <img
                    src={previewUrl || ''}
                    alt="Analyzed coop frame"
                    className="max-h-64 w-full object-contain"
                  />
                </div>

                <div className="flex flex-col justify-between space-y-4">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Flock Visual Assessment
                    </label>
                    <div className="mt-1.5">
                      <RiskAnalysisBadge
                        risk={analysisResult.aiResult.stress_risk}
                        confidence={analysisResult.aiResult.confidence}
                        indicators={analysisResult.aiResult.indicators}
                        showConfidence
                        showIndicators
                        size="md"
                      />
                    </div>
                  </div>

                  {/* AI Description */}
                  <div className="rounded-xl bg-slate-50 p-3.5 text-xs text-slate-700 border border-slate-200">
                    <span className="font-semibold block mb-1 text-slate-800 flex items-center gap-1.5">
                      <Eye size={13} className="text-blue-600" /> Visual Behavioral Summary:
                    </span>
                    <p className="leading-relaxed">{analysisResult.aiResult.description}</p>
                  </div>

                  <div className="rounded-xl bg-emerald-50/80 p-3 text-xs text-emerald-800 border border-emerald-200 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>Saved to your historical coop camera gallery.</span>
                  </div>
                </div>
              </div>

              {/* Suggestive Instructions & Action Checklist */}
              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-blue-50/30 p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-indigo-100/80 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                      <ShieldCheck size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        AI Suggestive Instructions & Care Plan
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Prioritized action protocol based on observed flock distress levels
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700">
                    {Object.values(completedSteps).filter(Boolean).length} / {suggestions.length} Completed
                  </span>
                </div>

                {suggestions.length > 0 ? (
                  <div className="space-y-2.5">
                    {suggestions.map((suggestion, idx) => {
                      const isDone = completedSteps[idx] || false;
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleStep(idx)}
                          className={`flex items-start gap-3 rounded-xl p-3 text-xs cursor-pointer transition-all border ${
                            isDone
                              ? 'bg-emerald-50/70 border-emerald-200 text-slate-500 line-through'
                              : 'bg-white border-slate-200/90 text-slate-800 hover:border-indigo-300 hover:shadow-xs'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() => toggleStep(idx)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <div className="flex-1">
                            <span className={isDone ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}>
                              {suggestion}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    No specific interventions required. Standard monitoring recommended.
                  </p>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={resetState}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Analyze Another Photo
                </button>
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="rounded-xl bg-slate-900 px-6 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-sm"
                >
                  Done & Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManualPhotoUploadModal;
