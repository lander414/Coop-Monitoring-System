export type StressRiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface TelemetryLog {
  id?: string;
  device_id: string;
  temperature: number;
  humidity: number;
  heat_index: number;
  chicken_present: boolean | null;
  stress_risk: StressRiskLevel;
  created_at?: string | null;
}

export interface AIAnalysisResult {
  stress_risk: StressRiskLevel;
  confidence: number;
  indicators: string[];
  description: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T | null;
  count?: number;
  error?: string;
  message?: string;
}