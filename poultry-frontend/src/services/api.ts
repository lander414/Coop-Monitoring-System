/// <reference types="vite/client" />
import type { EvaluationResponse, TelemetryLog, ApiResponse } from '../types/monitoring';
import { supabase } from '../lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000/api';

const authenticatedFetch = async (url: string, init?: RequestInit) => {
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
  const headers = new Headers(init?.headers);
  if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`);
  return fetch(url, { ...init, headers });
};

export const fetchLatestTelemetry = async (): Promise<TelemetryLog | null> => {
  const response = await authenticatedFetch(`${API_BASE_URL}/monitoring/latest`);
  const json: ApiResponse<TelemetryLog | null> = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error || 'Failed to fetch latest data');
  }

  return json.data ?? null;
};

export const fetchTelemetryHistory = async (
  limit: number = 50,
  range?: import('../types/monitoring').TimeRangeFilter
): Promise<TelemetryLog[]> => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (range && range !== 'all') params.set('range', range);
  const response = await authenticatedFetch(`${API_BASE_URL}/monitoring/history?${params.toString()}`);
  const json: ApiResponse<TelemetryLog[]> = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error || 'Failed to fetch history');
  }

  return json.data ?? [];
};

export const resolveFrameImageUrl = (imageUrlPath?: string): string => {
  if (!imageUrlPath) return '';
  if (imageUrlPath.startsWith('http://') || imageUrlPath.startsWith('https://')) return imageUrlPath;
  const baseUrl = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${baseUrl}${imageUrlPath.startsWith('/') ? '' : '/'}${imageUrlPath}`;
};

export const fetchLatestCameraFrame = async (deviceId: string = 'ESP32_COOP_01'): Promise<import('../types/monitoring').CameraFrame | null> => {
  const response = await authenticatedFetch(`${API_BASE_URL}/devices/${encodeURIComponent(deviceId)}/frames/latest`);
  const json: ApiResponse<import('../types/monitoring').CameraFrame | null> = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error || 'Failed to fetch latest camera frame');
  }

  return json.data ?? null;
};

export const fetchCameraFrameHistory = async (
  deviceId: string = 'ESP32_COOP_01',
  limit: number = 20,
  range?: import('../types/monitoring').TimeRangeFilter
): Promise<import('../types/monitoring').CameraFrame[]> => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (range && range !== 'all') params.set('range', range);
  const response = await authenticatedFetch(`${API_BASE_URL}/devices/${encodeURIComponent(deviceId)}/frames?${params.toString()}`);
  const json: ApiResponse<import('../types/monitoring').CameraFrame[]> = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error || 'Failed to fetch camera frame history');
  }

  return json.data ?? [];
};

export const evaluateChickenImage = async (formData: FormData): Promise<EvaluationResponse> => {
  const response = await authenticatedFetch(`${API_BASE_URL}/evaluate-risk`, {
    method: 'POST',
    body: formData,
  });
  const json = await response.json();
  if (!response.ok || !json.success) throw new Error(json.error || 'Failed to evaluate image');
  return json.data as EvaluationResponse;
};