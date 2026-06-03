from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).resolve().parents[1]
SIMULATION_DIR = ROOT_DIR / "simulation"

if str(SIMULATION_DIR) not in sys.path:
    sys.path.insert(0, str(SIMULATION_DIR))

from run_simulation import run_scenarios  # noqa: E402
from scenarios import scenario_catalog  # noqa: E402

app = FastAPI(title="Call Center Simulation API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_RESULTS_PATH = ROOT_DIR / "simulation" / "results" / "latest_results.json"
FALLBACK_RESULTS_PATH = ROOT_DIR / "simulation" / "simulation" / "results" / "latest_results.json"
ENV_RESULTS_KEY = "CALLCENTER_RESULTS_PATH"
HISTORY_DIR = ROOT_DIR / "simulation" / "results" / "runs"
HISTORY_INDEX_PATH = ROOT_DIR / "simulation" / "results" / "runs_index.json"
DASHBOARD_DIST_DIR = ROOT_DIR / "dashboard" / "dist"
DASHBOARD_INDEX_PATH = DASHBOARD_DIST_DIR / "index.html"


class RunSimulationRequest(BaseModel):
    scenario: str | list[str] = Field(default="all", description="Scenario id, list of ids, or 'all'.")
    seed: int = Field(default=20260418, ge=0)
    replications: int | None = Field(default=None, ge=1)
    output_path: str | None = Field(default=None, description="Optional custom output path for JSON export.")
    save_output: bool = Field(default=True)


class RunSimulationResponse(BaseModel):
    meta: dict[str, Any]
    comparison: list[dict[str, Any]]
    run_id: str | None
    output_path: str | None


class RunRecord(BaseModel):
    run_id: str
    generated_at: str
    base_seed: int
    scenario_count: int
    scenario_ids: list[str]
    output_path: str


def _ensure_history_dir() -> None:
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)


def _build_run_id() -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    return f"run-{timestamp}-{uuid4().hex[:8]}"


def _load_history_index() -> list[dict[str, Any]]:
    if not HISTORY_INDEX_PATH.exists():
        return []

    try:
        data = json.loads(HISTORY_INDEX_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Invalid history index JSON: {exc}") from exc

    if not isinstance(data, list):
        raise HTTPException(status_code=500, detail="History index must contain a list of run records.")

    return data


def _save_history_index(records: list[dict[str, Any]]) -> None:
    _ensure_history_dir()
    HISTORY_INDEX_PATH.write_text(json.dumps(records, indent=2), encoding="utf-8")


def _register_run(payload: dict[str, Any], output_path: Path, scenario_ids: list[str], base_seed: int) -> dict[str, Any]:
    run_id = payload.get("meta", {}).get("run_id") or _build_run_id()
    payload.setdefault("meta", {})
    payload["meta"]["run_id"] = run_id

    record = {
        "run_id": run_id,
        "generated_at": payload.get("meta", {}).get("generated_at", datetime.now(timezone.utc).isoformat()),
        "base_seed": base_seed,
        "scenario_count": len(scenario_ids),
        "scenario_ids": scenario_ids,
        "output_path": str(output_path),
    }

    records = _load_history_index()
    records = [existing for existing in records if existing.get("run_id") != run_id]
    records.insert(0, record)
    _save_history_index(records)
    return record


def _normalize_scenarios(scenario_input: str | list[str]) -> list[str]:
    catalog = scenario_catalog()

    if isinstance(scenario_input, str):
        if scenario_input == "all":
            return list(catalog.keys())
        if scenario_input not in catalog:
            raise HTTPException(status_code=400, detail=f"Unknown scenario '{scenario_input}'.")
        return [scenario_input]

    unknown = [sid for sid in scenario_input if sid not in catalog]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown scenario ids: {', '.join(unknown)}")

    if not scenario_input:
        raise HTTPException(status_code=400, detail="Scenario list cannot be empty.")

    return scenario_input


def _resolve_results_path(override: str | None = None) -> Path:
    if override:
        path = Path(override)
        return path if path.is_absolute() else ROOT_DIR / path

    env_path = os.getenv(ENV_RESULTS_KEY)
    if env_path:
        env_file = Path(env_path)
        return env_file if env_file.is_absolute() else ROOT_DIR / env_file

    if DEFAULT_RESULTS_PATH.exists():
        return DEFAULT_RESULTS_PATH

    if FALLBACK_RESULTS_PATH.exists():
        return FALLBACK_RESULTS_PATH

    return DEFAULT_RESULTS_PATH


def _read_exported_payload(path_override: str | None = None) -> tuple[dict[str, Any], Path]:
    results_path = _resolve_results_path(path_override)

    if not results_path.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                "No simulation output file found. Run /run-simulation first or provide CALLCENTER_RESULTS_PATH."
            ),
        )

    try:
        payload = json.loads(results_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Invalid JSON in results file: {exc}") from exc

    return payload, results_path


@app.get("/health")
@app.get("/api/health", include_in_schema=False)
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/run-simulation", response_model=RunSimulationResponse)
@app.post("/api/run-simulation", response_model=RunSimulationResponse, include_in_schema=False)
def run_simulation(request: RunSimulationRequest) -> RunSimulationResponse:
    scenario_ids = _normalize_scenarios(request.scenario)
    payload = run_scenarios(
        scenario_ids=scenario_ids,
        base_seed=request.seed,
        replications=request.replications,
    )

    output_path: str | None = None
    run_id: str | None = None
    if request.save_output:
        _ensure_history_dir()
        run_id = _build_run_id()
        payload.setdefault("meta", {})
        payload["meta"]["run_id"] = run_id

        resolved_output = _resolve_results_path(request.output_path) if request.output_path else (HISTORY_DIR / f"{run_id}.json")
        resolved_output.parent.mkdir(parents=True, exist_ok=True)
        resolved_output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        output_path = str(resolved_output)

        _register_run(payload=payload, output_path=resolved_output, scenario_ids=scenario_ids, base_seed=request.seed)

    return RunSimulationResponse(meta=payload["meta"], comparison=payload["comparison"], run_id=run_id, output_path=output_path)


@app.get("/compare-scenarios")
@app.get("/api/compare-scenarios", include_in_schema=False)
def compare_scenarios(results_path: str | None = Query(default=None)) -> dict[str, Any]:
    payload, source_path = _read_exported_payload(results_path)
    return {
        "meta": payload.get("meta", {}),
        "comparison": payload.get("comparison", []),
        "source_path": str(source_path),
    }


@app.get("/get-metrics")
@app.get("/api/get-metrics", include_in_schema=False)
def get_metrics(
    scenario_id: str | None = Query(default=None, description="Optional scenario id filter."),
    results_path: str | None = Query(default=None),
) -> dict[str, Any]:
    payload, source_path = _read_exported_payload(results_path)
    scenarios = payload.get("scenarios", [])

    if scenario_id is None:
        return {
            "meta": payload.get("meta", {}),
            "scenario_count": len(scenarios),
            "aggregates": [
                {
                    "scenario_id": scenario.get("scenario", {}).get("scenario_id"),
                    "scenario_name": scenario.get("scenario", {}).get("name"),
                    "kpis": scenario.get("aggregates", {}).get("kpis", {}),
                    "confidence_intervals_95": scenario.get("aggregates", {}).get(
                        "confidence_intervals_95", {}
                    ),
                }
                for scenario in scenarios
            ],
            "source_path": str(source_path),
        }

    selected = [s for s in scenarios if s.get("scenario", {}).get("scenario_id") == scenario_id]
    if not selected:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found in exported results.")

    scenario = selected[0]
    return {
        "meta": payload.get("meta", {}),
        "scenario": scenario.get("scenario", {}),
        "aggregates": scenario.get("aggregates", {}),
        "replication_count": len(scenario.get("replications", [])),
        "source_path": str(source_path),
    }


@app.get("/runs", response_model=list[RunRecord])
@app.get("/api/runs", response_model=list[RunRecord], include_in_schema=False)
def list_runs(limit: int | None = Query(default=None, ge=1)) -> list[RunRecord]:
    if not isinstance(limit, int):
        limit = None

    records = [RunRecord(**record) for record in _load_history_index()]
    if limit is not None:
        return records[:limit]
    return records


@app.get("/runs/{run_id}")
@app.get("/api/runs/{run_id}", include_in_schema=False)
def get_run(run_id: str) -> dict[str, Any]:
    history = _load_history_index()
    record = next((entry for entry in history if entry.get("run_id") == run_id), None)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")

    output_path = Path(record["output_path"])
    if not output_path.exists():
        raise HTTPException(status_code=404, detail=f"Run output file missing at '{output_path}'.")

    try:
        payload = json.loads(output_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Invalid run JSON: {exc}") from exc

    return {"record": record, "payload": payload}


if DASHBOARD_DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DASHBOARD_DIST_DIR / "assets"), name="dashboard-assets")


@app.get("/{full_path:path}", include_in_schema=False)
def serve_dashboard(full_path: str) -> FileResponse:
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API route not found.")

    if not DASHBOARD_INDEX_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Dashboard build not found. Run `npm run build` in dashboard or build the Docker image.",
        )

    return FileResponse(DASHBOARD_INDEX_PATH)
