FROM node:20-slim AS dashboard-build

WORKDIR /app/dashboard

COPY dashboard/package*.json ./
RUN npm ci

COPY dashboard/ ./
RUN npm run build

FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY api ./api
COPY simulation ./simulation
COPY contracts ./contracts
COPY --from=dashboard-build /app/dashboard/dist ./dashboard/dist

EXPOSE 8000

CMD uvicorn api.main:app --host 0.0.0.0 --port ${PORT}
