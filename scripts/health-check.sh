#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MAX_RETRIES=10
RETRY_DELAY=5
SERVICES=(
  "8001:alert-ingestion"
  "8002:incident-management"
  "8003:oncall-service"
  "8004:notification-service"
  "8005:service-metrics"
  "9090:prometheus"
  "9093:alertmanager"
)

# Variables
FAILED_SERVICES=()
PASSED_SERVICES=()

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🏥 Health Check – All Services"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Function to check health
check_health() {
  local PORT=$1
  local SERVICE_NAME=$2
  local ENDPOINT=$3

  echo -e "${BLUE}🔍 Checking ${SERVICE_NAME} on port ${PORT}...${NC}"

  RETRY_COUNT=0
  while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -sf "http://localhost:${PORT}${ENDPOINT}" > /dev/null 2>&1; then
      echo -e "${GREEN}✅ ${SERVICE_NAME} (${PORT}) is healthy${NC}"
      PASSED_SERVICES+=("$SERVICE_NAME:$PORT")
      return 0
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
      echo -e "${YELLOW}   ⏳ Attempt $RETRY_COUNT/$MAX_RETRIES - retrying in ${RETRY_DELAY}s...${NC}"
      sleep $RETRY_DELAY
    fi
  done

  echo -e "${RED}❌ ${SERVICE_NAME} (${PORT}) health check failed${NC}"
  FAILED_SERVICES+=("$SERVICE_NAME:$PORT")
  return 1
}

# Check each service
for SERVICE_INFO in "${SERVICES[@]}"; do
  PORT="${SERVICE_INFO%%:*}"
  SERVICE_NAME="${SERVICE_INFO##*:}"
  
  # Determine endpoint based on service
  if [ "$PORT" == "9090" ] || [ "$PORT" == "9093" ]; then
    ENDPOINT="/-/healthy"
  else
    ENDPOINT="/health"
  fi

  check_health "$PORT" "$SERVICE_NAME" "$ENDPOINT"
  echo ""
done

# Summary
echo "═══════════════════════════════════════════════════════════════"
echo "📊 Health Check Summary"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Total Services: ${#SERVICES[@]}"
echo -e "${GREEN}Passed: ${#PASSED_SERVICES[@]}${NC}"
echo -e "${RED}Failed: ${#FAILED_SERVICES[@]}${NC}"
echo ""

if [ ${#PASSED_SERVICES[@]} -gt 0 ]; then
  echo -e "${GREEN}Passed Services:${NC}"
  for SERVICE in "${PASSED_SERVICES[@]}"; do
    echo -e "  ${GREEN}🟢${NC} $SERVICE"
  done
  echo ""
fi

if [ ${#FAILED_SERVICES[@]} -gt 0 ]; then
  echo -e "${RED}Failed Services:${NC}"
  for SERVICE in "${FAILED_SERVICES[@]}"; do
    echo -e "  ${RED}🔴${NC} $SERVICE"
  done
  echo ""
  echo -e "${RED}❌ Some services are not healthy${NC}"
  exit 1
else
  echo -e "${GREEN}✅ All services are healthy!${NC}"
  echo "═══════════════════════════════════════════════════════════════"
  exit 0
fi
