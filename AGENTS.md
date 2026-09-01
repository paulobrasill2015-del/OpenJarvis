# AGENTS.md — Base44 Dev Environment

## Project Overview

OpenJarvis is a local-first personal AI framework. It has three main components:

1. **Rust extension** (`rust/`) — a mandatory PyO3 module (`openjarvis_rust`) built
   with maturin. Many core modules (security scanners, tools, storage) import it
   with no Python fallback. It MUST be built for the server to start.
2. **Python backend** (`src/openjarvis/`) — FastAPI server started via
   `jarvis serve`. Uses `uv` for dependency management. The `server` extra
   (fastapi, uvicorn, pydantic) and `desktop-native` dependency group (the Rust
   extension) are required.
3. **Frontend** (`frontend/`) — Vite + React 19 SPA. Builds to
   `src/openjarvis/server/static` for production; in dev it runs on port 5173
   and proxies `/v1`, `/health`, `/api` to the backend.

## Dev Environment (docker-compose.base44.yml)

- **ollama** — inference engine (image `ollama/ollama:0.30.10`).
- **ollama-pull** — one-shot service that pulls `qwen3:1.7b`.
- **backend** — built from `Dockerfile.base44` (python:3.12-slim + Rust 1.88 + uv).
  The venv lives at `/opt/venv` (outside the bind mount). Source is bind-mounted
  at `/app`. Runs `jarvis serve --host 0.0.0.0 --port 8000 --engine ollama`.
- **frontend** — `node:22-slim`, installs npm 11 (required by package.json
  engines), then runs Vite on port 5173 → mapped to host port 3000.

## Key Configuration

- **API key**: `OPENJARVIS_API_KEY=dev-only-key-base44` (required for non-loopback
  bind). The frontend gets it via `VITE_OPENJARVIS_API_KEY`.
- **Ollama host**: `OLLAMA_HOST=http://ollama:11434` (set in backend env).
- **Vite proxy**: `API_PROXY_TARGET=http://backend:8000` (server-side only, not
  `VITE_`-prefixed, so the browser uses relative URLs through the proxy).
- **OPENJARVIS_HOME**: `/data` (volume) so runtime state doesn't clutter the repo.
- **vite.config.ts** changes: `server.host: true`, `server.allowedHosts: true`
  (for the preview's external hostname), and `API_PROXY_TARGET` env var for the
  proxy target (keeps `VITE_API_URL` unset for single-origin browser requests).

## Verifying the App

```bash
# All services up
docker compose -f docker-compose.base44.yml ps

# Backend health
curl http://localhost:8000/health   # → {"status":"ok"}

# Models (needs auth)
curl -H "Authorization: Bearer dev-only-key-base44" http://localhost:8000/v1/models

# Frontend (external host check)
curl -H "Host: external-preview.example.com" http://localhost:3000/

# Proxy test
curl http://localhost:3000/health   # → {"status":"ok"} (proxied to backend)
```

## Building the Rust Extension

The `Dockerfile.base44` image builds the extension at image-build time via
`uv sync --group desktop-native --extra server --frozen`. The compiled `.so`
lives in `/opt/venv/site-packages` and survives the runtime bind mount. If Rust
source changes, rebuild the image: `docker compose -f docker-compose.base44.yml
build backend`.

## No External Secrets Required

The app boots without any external API keys. Cloud inference keys
(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.) are optional — without them, the
server uses the local Ollama engine. Telemetry is disabled via
`.env.base44-defaults`.
