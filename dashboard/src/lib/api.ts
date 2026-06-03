import type { ComparisonRow, HistoricalRunPayload, RunRecord } from '../types';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '/api');

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchComparison(): Promise<ComparisonRow[]> {
  const payload = await requestJson<{ comparison: ComparisonRow[] }>('/compare-scenarios');
  return payload.comparison;
}

export async function fetchRuns(): Promise<RunRecord[]> {
  return requestJson<RunRecord[]>('/runs');
}

export async function fetchRun(runId: string): Promise<HistoricalRunPayload> {
  return requestJson<HistoricalRunPayload>(`/runs/${runId}`);
}

export async function fetchMetrics(scenarioId?: string) {
  const query = scenarioId ? `?scenario_id=${encodeURIComponent(scenarioId)}` : '';
  return requestJson(`/get-metrics${query}`);
}

export async function createSimulationRun() {
  return requestJson<{ run_id: string | null }>('/run-simulation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ scenario: 'all', save_output: true }),
  });
}
