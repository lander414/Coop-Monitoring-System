import React from 'react';
import type { StressRiskLevel } from '../types/monitoring';

export interface RiskAnalysisBadgeProps {
  risk?: StressRiskLevel | 'UNKNOWN' | null;
  confidence?: number | null;
  indicators?: string[] | null;
  showConfidence?: boolean;
  showIndicators?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const riskConfig: Record<
  StressRiskLevel | 'UNKNOWN',
  { label: string; badge: string; dotColor: string }
> = {
  NONE: { label: 'No Risk', badge: 'bg-slate-100 text-slate-700 border-slate-200', dotColor: 'bg-slate-400' },
  LOW: { label: 'Comfortable (Low Risk)', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dotColor: 'bg-emerald-500' },
  MEDIUM: { label: 'Moderate Stress', badge: 'bg-amber-50 text-amber-700 border-amber-200', dotColor: 'bg-amber-500' },
  HIGH: { label: 'High Distress Risk', badge: 'bg-red-50 text-red-700 border-red-200', dotColor: 'bg-red-500' },
  UNKNOWN: { label: 'Pending Assessment', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', dotColor: 'bg-indigo-400' },
};

export const RiskAnalysisBadge: React.FC<RiskAnalysisBadgeProps> = ({
  risk = 'UNKNOWN',
  confidence,
  indicators,
  showConfidence = false,
  showIndicators = false,
  size = 'md',
  className = '',
}) => {
  const currentRisk = risk || 'UNKNOWN';
  const config = riskConfig[currentRisk] || riskConfig.UNKNOWN;

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-3 py-1 gap-2',
    lg: 'text-sm px-4 py-1.5 gap-2.5 font-bold',
  }[size];

  const confidencePct = confidence != null
    ? (confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence))
    : null;

  return (
    <div className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <span
        className={`inline-flex items-center rounded-full border font-bold uppercase tracking-wide transition-all ${config.badge} ${sizeClasses}`}
      >
        <span className={`h-2 w-2 rounded-full ${config.dotColor} ${currentRisk === 'HIGH' ? 'animate-ping' : ''}`} />
        <span>{config.label}</span>
      </span>

      {showConfidence && confidencePct !== null && (
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
          {confidencePct}% Confidence
        </span>
      )}

      {showIndicators && indicators && indicators.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {indicators.map((ind, i) => (
            <span
              key={i}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200"
            >
              {ind}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default RiskAnalysisBadge;
