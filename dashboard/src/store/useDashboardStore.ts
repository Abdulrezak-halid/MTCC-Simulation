import { create } from 'zustand';
import type { ComparisonRow, HistoricalRunPayload, RunRecord } from '../types';
import { createSimulationRun, fetchComparison, fetchRun, fetchRuns } from '../lib/api';

type DashboardState = {
  comparison: ComparisonRow[];
  runs: RunRecord[];
  activeRun?: HistoricalRunPayload;
  selectedRunId?: string;
  loading: boolean;
  error?: string;
  loadAll: () => Promise<void>;
  selectRun: (runId: string) => Promise<void>;
  generateRun: () => Promise<void>;
};

export const useDashboardStore = create<DashboardState>((set, get) => ({
  comparison: [],
  runs: [],
  loading: false,
  loadAll: async () => {
    set({ loading: true, error: undefined });
    try {
      const [comparison, runs] = await Promise.all([fetchComparison(), fetchRuns()]);
      set({ comparison, runs, loading: false, selectedRunId: runs[0]?.run_id });
      if (runs[0]) {
        const activeRun = await fetchRun(runs[0].run_id);
        set({ activeRun });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load dashboard data', loading: false });
    }
  },
  selectRun: async (runId: string) => {
    if (!runId) {
      return;
    }

    set({ loading: true, error: undefined, selectedRunId: runId });
    try {
      const activeRun = await fetchRun(runId);
      set({ activeRun, loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load run', loading: false });
    }
  },
  generateRun: async () => {
    set({ loading: true, error: undefined });
    try {
      const createdRun = await createSimulationRun();
      const [comparison, runs] = await Promise.all([fetchComparison(), fetchRuns()]);
      const selectedRunId = createdRun.run_id ?? runs[0]?.run_id;
      set({ comparison, runs, selectedRunId });

      if (selectedRunId) {
        const activeRun = await fetchRun(selectedRunId);
        set({ activeRun, loading: false });
        return;
      }

      set({ loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to run simulation', loading: false });
    }
  },
}));
