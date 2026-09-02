/// <reference types="vite/client" />
import type { EvaluationResponse, TelemetryLog, ApiResponse } from '../types/monitoring';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000/api';

export const fetchLatestTelemetry = async (): Promise<TelemetryLog | null> => {
  const response = await fetch(`${API_BASE_URL}/monitoring/latest`);
  const json: ApiResponse<TelemetryLog | null> = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error || 'Failed to fetch latest data');
  }

  return json.data ?? null;
};

export const fetchTelemetryHistory = async (limit: number = 50): Promise<TelemetryLog[]> => {
  const response = await fetch(`${API_BASE_URL}/monitoring/history?limit=${limit}`);
  const json: ApiResponse<TelemetryLog[]> = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error || 'Failed to fetch history');
  }

  return json.data ?? [];
};

export const evaluateChickenImage = async (formData: FormData): Promise<EvaluationResponse> => {
  const response = await fetch(`${API_BASE_URL}/evaluate-risk`, {
    method: 'POST',
    body: formData,
  });
  const json = await response.json();
  if (!response.ok || !json.success) throw new Error(json.error || 'Failed to evaluate image');
  return json.data as EvaluationResponse;
};