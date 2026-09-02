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

export interface ApiResponse<T> {
  success: boolean;
  data?: T | null;
  count?: number;
  error?: string;
  message?: string;
}