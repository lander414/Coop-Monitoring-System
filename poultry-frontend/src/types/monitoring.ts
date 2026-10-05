export type StressRiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export type TimeRangeFilter = 'hourly' | 'daily' | 'weekly' | 'all';

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
  stress_risk: StressRiskLevel | 'UNKNOWN';
  confidence: number;
  indicators: string[];
  description: string;
}

export interface EvaluationResponse {
  imageId: string;
  sensorInputs: {
    temperature: number;
    humidity: number;
    heatIndex: number;
    motionLevel: string;
    aiStressRisk: StressRiskLevel | 'UNKNOWN';
  };
  aiResult: AIAnalysisResult;
  finalAssessment: {
    environmentalRisk: StressRiskLevel;
    finalStressRisk: StressRiskLevel;
    evaluationSummary: string;
  };
  hardwareCommand: {
    rgbIndicator: {
      color: string;
      red: number;
      green: number;
      blue: number;
    };
  };
}

export interface CameraFrame {
  frame_id: string;
  device_id: string;
  captured_at?: string | null;
  uploaded_at: string;
  sequence_id?: string | null;
  firmware_version?: string | null;
  storage_name: string;
  mime_type: string;
  size_in_bytes: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_started_at?: string | null;
  processed_at?: string | null;
  ai_stress_risk?: StressRiskLevel | 'UNKNOWN' | null;
  ai_confidence?: number | null;
  ai_indicators?: string[] | null;
  ai_description?: string | null;
  processing_error?: string | null;
  imageUrl?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T | null;
  count?: number;
  error?: string;
  message?: string;
}