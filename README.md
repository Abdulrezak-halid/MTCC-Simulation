<img width="1536" height="1024" alt="Multi-tier call center simulation overview" src="https://github.com/user-attachments/assets/ae268d7c-18d9-425e-81f3-9fe6da3711ca" />

# Multi-Tier Call Center Simulation

A probabilistic discrete-event simulation of a multi-tier support center with:

- Python + SimPy simulation engine
- FastAPI service layer
- React + TypeScript dashboard

<p align="center" width="1536" height="1024">
  <img src="https://github.com/user-attachments/assets/dd09e3e4-26ce-4040-8581-73a38be1e06e" width="600"/>
</p>


## What This Project Includes
## **[View Live Demo](https://multi-tier-call-center-simulation.onrender.com/)** 👁️
- Scenario-based call center simulation with Monte Carlo replications
- API endpoints to run simulations and fetch metrics/results
- Dashboard scaffold for scenario comparison and run history
- JSON Schema and OpenAPI contract artifacts

## Core Scenarios

- normal_load
- peak_load
- reduced_staff
- increased_vip_ratio
- improved_efficiency

## API Endpoints

```
POST /run-simulation
GET  /compare-scenarios
GET  /get-metrics
GET  /runs
GET  /runs/{run_id}
GET  /health
```

Quick browser access:

- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc
- Health: http://127.0.0.1:8000/health

## Documentation

- Project structure and file purpose: [assets/doc/project-structure.md](assets/doc/project-structure.md)
- Full run steps (data + simulation + API + UI): [assets/doc/run-steps.md](assets/doc/run-steps.md)
- Status snapshot: [assets/doc/status-summary.md](assets/doc/status-summary.md)
- UI presentation Q&A: [assets/doc/ui-presentation-guide.md](assets/doc/ui-presentation-guide.md)

## Contracts

- [contracts/simulation-output.schema.json](contracts/simulation-output.schema.json)
- [contracts/api.openapi.yaml](contracts/api.openapi.yaml)

## Tests

Run API persistence and schema tests:

```bash
source .venv/bin/activate
python3 -m unittest discover -s tests
```

## Docker Deployment

Build and run the full app in one container:

```bash
docker compose up --build
```

Then open:

- Dashboard: http://127.0.0.1:8000
- API docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/api/health

The Docker image builds the React dashboard first, copies the static files into the Python image, and serves everything through FastAPI. The API is available at both the original root endpoints and `/api/...`; the production dashboard uses `/api` automatically.

For single-service hosting on Render, Railway, Fly.io, or a similar platform, deploy this repository as a Docker app and expose port `8000`. If the platform injects a `PORT` environment variable, the container command will use it.
