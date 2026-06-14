import { useEffect } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDashboardStore } from "./store/useDashboardStore";
import type { ComparisonRow, HistoricalRunPayload, RunRecord } from "./types";

const scenarioPalette = [
  "#22d3ee",
  "#f97316",
  "#a3e635",
  "#f43f5e",
  "#facc15",
  "#8b5cf6",
  "#14b8a6",
  "#38bdf8",
];

const simulationSteps = [
  {
    title: "Choose a scenario",
    text: "Each run compares operating conditions such as normal demand, peak load, reduced staffing, more VIP callers, or faster staff handling.",
  },
  {
    title: "Simulate caller flow",
    text: "Calls arrive over the workday, pass through IVR, wait for Tier 1, and either get resolved, abandon the queue, or escalate to Tier 2.",
  },
  {
    title: "Read the outcome",
    text: "The dashboard turns every run into KPIs: average wait, SLA compliance, agent utilization, abandonment, and scenario-to-scenario comparison.",
  },
];

const userActions = [
  "Press Generate run to create a new simulation snapshot from the API.",
  "Select a saved run to inspect previous results without opening raw JSON.",
  "Compare scenarios to decide which staffing or demand condition performs best.",
];

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

function formatRunLabel(run: RunRecord) {
  return `${formatDateTime(run.generated_at)} UTC · ${run.scenario_count} scenarios · seed ${run.base_seed}`;
}

function formatRunShortId(runId: string) {
  const match = runId.match(/^run-(\d{8}T\d{6})\d*Z-([a-z0-9]+)$/i);
  if (!match) {
    return runId;
  }
  return `run-${match[1]}-${match[2]}`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatSeconds(value: number) {
  return `${value.toFixed(1)}s`;
}

export default function App() {
  const {
    comparison,
    runs,
    activeRun,
    loading,
    error,
    loadAll,
    selectRun,
    generateRun,
    selectedRunId,
  } = useDashboardStore();

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const selectedScenarioId =
    activeRun?.payload.scenarios[0]?.scenario.scenario_id ??
    comparison[0]?.scenario_id;
  const selectedScenario = activeRun?.payload.scenarios.find(
    (scenario: HistoricalRunPayload["payload"]["scenarios"][number]) =>
      scenario.scenario.scenario_id === selectedScenarioId,
  );
  const selectedComparison = comparison.find(
    (scenario: ComparisonRow) => scenario.scenario_id === selectedScenarioId,
  );
  const kpis = selectedScenario?.aggregates.kpis ?? selectedComparison ?? {};
  const selectedScenarioName =
    selectedScenario?.scenario.name ??
    selectedComparison?.scenario_name ??
    "No scenario selected";

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Call Center Control Room</p>
          <h1>Simulation comparison dashboard</h1>
          <p className="lede">
            A compact view of scenario performance, historical runs, and the
            current exported simulation payload.
          </p>
        </div>
        <div className="hero-card">
          <div className="hero-card-title">Current run</div>
          <div className="hero-card-value">
            {activeRun ? formatRunLabel(activeRun.record) : "Latest exported results"}
          </div>
          <div className="hero-card-subtitle">
            {activeRun
              ? `ID: ${formatRunShortId(activeRun.record.run_id)}`
              : "Generate a run to save a historical snapshot"}
          </div>
        </div>
      </header>

      <main className="grid">
        <section className="panel panel-instructions">
          <div className="panel-header">
            <h2>How the simulation works</h2>
            <span>Project guide</span>
          </div>
          <div className="instructions-layout">
            <div>
              <p className="instructions-intro">
                This project models a multi-tier call center so you can test how
                demand, staffing, VIP priority, and service efficiency affect
                customer waiting time and service quality.
              </p>
              <div className="step-grid">
                {simulationSteps.map((step, index) => (
                  <article className="step-card" key={step.title}>
                    <span className="step-index">{index + 1}</span>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </article>
                ))}
              </div>
            </div>
            <aside className="visitor-guide">
              <h3>What you do here</h3>
              <ul>
                {userActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </aside>
          </div>
        </section>

        <section className="panel panel-comparison">
          <div className="panel-header">
            <h2>Scenario comparison</h2>
            <span>{comparison.length} scenarios</span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={comparison}
                margin={{ top: 16, right: 20, bottom: 8, left: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.08)"
                />
                <XAxis
                  dataKey="scenario_name"
                  tick={{ fill: "#dbe4ff", fontSize: 12 }}
                />
                <YAxis tick={{ fill: "#dbe4ff", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "#10162d",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                  labelStyle={{ color: "#ffffff" }}
                  itemStyle={{ color: "#ffffff" }}
                />
                <Bar dataKey="avg_wait_seconds" radius={[10, 10, 0, 0]}>
                  {comparison.map((entry, index) => (
                    <Cell
                      key={entry.scenario_id}
                      fill={scenarioPalette[index % scenarioPalette.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel panel-history">
          <div className="panel-header">
            <h2>Historical runs</h2>
            <span>{runs.length} saved</span>
          </div>
          <div className="run-list">
            {runs.length === 0 ? (
              <div className="empty-state">
                No saved runs yet. Generate a run to create the first snapshot.
              </div>
            ) : null}
            {runs.map((run) => (
              <button
                key={run.run_id}
                type="button"
                className={
                  run.run_id === selectedRunId ? "run-item active" : "run-item"
                }
                onClick={() => void selectRun(run.run_id)}
              >
                <strong>{formatDateTime(run.generated_at)} UTC</strong>
                <span>
                  {run.scenario_count} scenarios · seed {run.base_seed} ·{" "}
                  {formatRunShortId(run.run_id)}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel panel-controls">
          <div className="panel-header">
            <h2>Current run controls</h2>
            <span>{loading ? "Loading..." : "Ready"}</span>
          </div>
          <div className="control-stack">
            <label>
              <span>Active run</span>
              <select
                value={selectedRunId ?? ""}
                onChange={(event) => void selectRun(event.target.value)}
                disabled={runs.length === 0 || loading}
              >
                {runs.length === 0 ? (
                  <option value="">No saved runs yet</option>
                ) : null}
                {runs.map((run) => (
                  <option key={run.run_id} value={run.run_id}>
                    {formatDateTime(run.generated_at)} UTC · seed{" "}
                    {run.base_seed}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="primary-button"
              onClick={() => void generateRun()}
              disabled={loading}
            >
              {loading ? "Running simulation..." : "Generate run"}
            </button>
            <label>
              <span>API status</span>
              <input value={error ?? "Connected to API contract"} readOnly />
            </label>
          </div>
        </section>

        <section className="panel panel-kpi">
          <div className="panel-header">
            <h2>KPI snapshot</h2>
            <span>{selectedScenarioName}</span>
          </div>
          <div className="kpi-grid">
            <article className="kpi-card">
              <span>Average wait (seconds)</span>
              <strong>
                {typeof kpis.avg_wait_seconds === "number"
                  ? formatSeconds(kpis.avg_wait_seconds)
                  : "—"}
              </strong>
            </article>
            <article className="kpi-card">
              <span>SLA compliance</span>
              <strong>
                {typeof kpis.sla_compliance_rate === "number"
                  ? formatPercent(kpis.sla_compliance_rate)
                  : "—"}
              </strong>
            </article>
            <article className="kpi-card">
              <span>Tier 1 utilization</span>
              <strong>
                {typeof kpis.utilization_tier1 === "number"
                  ? formatPercent(kpis.utilization_tier1)
                  : "—"}
              </strong>
            </article>
            <article className="kpi-card">
              <span>Abandonment</span>
              <strong>
                {typeof kpis.abandonment_rate === "number"
                  ? formatPercent(kpis.abandonment_rate)
                  : "—"}
              </strong>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
