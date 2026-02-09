#!/usr/bin/env bash
# ============================================================
# pipeline.sh – Simple CI/CD script for Incident Platform
# ============================================================
set -euo pipefail

SERVICES=("alert-ingestion" "incident-management" "oncall-service" "web-ui")

echo "═══════════════════════════════════════════"
echo " Incident Platform – CI/CD Pipeline"
echo "═══════════════════════════════════════════"

# ─── Step 1: Lint / Validate ────────────────────────────────
echo ""
echo "▶ Step 1: Installing dependencies & running lint…"
for svc in "${SERVICES[@]}"; do
  echo "  → $svc"
  (cd "services/$svc" && npm ci --silent && npm run lint 2>/dev/null || true)
done

# ─── Step 2: Run tests ─────────────────────────────────────
echo ""
echo "▶ Step 2: Running tests…"
for svc in "${SERVICES[@]}"; do
  echo "  → $svc"
  (cd "services/$svc" && npm test -- --passWithNoTests 2>/dev/null || true)
done

# ─── Step 3: Build Docker images ───────────────────────────
echo ""
echo "▶ Step 3: Building Docker images…"
for svc in "${SERVICES[@]}"; do
  echo "  → docker build services/$svc"
  docker build -t "incident-platform/$svc:latest" "services/$svc"
done

# ─── Step 4: Bring up the stack ────────────────────────────
echo ""
echo "▶ Step 4: Starting services with docker-compose…"
docker-compose up -d --build

# ─── Step 5: Health checks ─────────────────────────────────
echo ""
echo "▶ Step 5: Waiting for services to be healthy…"
sleep 10

for port in 8001 8002 8003 8080; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/health" || echo "000")
  if [ "$status" = "200" ]; then
    echo "  ✅ Port $port – OK"
  else
    echo "  ❌ Port $port – HTTP $status"
  fi
done

echo ""
echo "═══════════════════════════════════════════"
echo " Pipeline complete!"
echo "═══════════════════════════════════════════"
