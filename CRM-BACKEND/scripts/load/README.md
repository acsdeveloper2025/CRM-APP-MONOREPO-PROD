# Backend load-test harness — Phase F5

Lightweight k6 scripts that exercise the 10 highest-traffic backend
endpoints so we can catch latency regressions before they ship.

## Why k6

- Single static binary (no runtime)
- JS test definitions that live next to the backend source
- Built-in thresholds + CLI exit codes → wire directly into CI
- Reports p50 / p95 / p99 out of the box

## Running locally

```bash
# Install k6:
#   macOS:  brew install k6
#   Linux:  sudo apt-get install k6
#   Docker: docker run --rm -i grafana/k6 run - <scripts/load/smoke.js

# Fast smoke test — ~30s, 5 VUs
k6 run scripts/load/smoke.js \
  -e BASE_URL=http://localhost:3000 \
  -e AUTH_TOKEN="$(./scripts/load/get-token.sh)"

# Full scenario — ~5min, 200 VUs
k6 run scripts/load/scenarios.js \
  -e BASE_URL=http://localhost:3000 \
  -e AUTH_TOKEN="$(./scripts/load/get-token.sh)"
```

## Thresholds

Each scenario defines thresholds that fail the run if breached:

- `http_req_duration{expected_response:true}` — p95 < 500ms, p99 < 1500ms
- `http_req_failed` — rate < 1%
- Per-endpoint tags (e.g. `endpoint:cases_list`) get their own
  threshold so a regression in one route can't hide behind
  healthy averages elsewhere.

## CI wiring

See `.github/workflows/load-test.yml`. The smoke run is triggered
on every PR against `main`. The full scenario is workflow-dispatch
only because it needs a seeded staging database and a dedicated
load-test backend instance.

## Scenarios

| File | VUs | Duration | Endpoints |
|------|-----|----------|-----------|
| `smoke.js` | 5 | 30s | Health + auth + list cases |
| `scenarios.js` | 200 | 5min ramp | 10 high-traffic endpoints |

## Interpreting results

- `http_req_duration`: end-to-end request time including DNS/TCP/TLS.
- `http_req_waiting` (TTFB): server-side processing time only —
  compare against the `performance_metrics` avg_response_time to
  isolate backend vs network.
- Each scenario dumps an `ops-summary.json` file consumable by
  Grafana if you want to store historical runs.

## Adding an endpoint

1. Add a new `group(...)` block to `scenarios.js` tagging the
   request with `tags: { endpoint: '<name>' }`.
2. Add a matching threshold line in the same file.
3. Rerun the smoke script locally to validate the new group.
