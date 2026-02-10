#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables
SERVICES=("alert-ingestion" "incident-management" "oncall-service" "notification-service" "service-metrics")
FAILED=0
PASSED=0

echo "================================================"
echo "🧪 Testing & Linting All Services"
echo "================================================"
echo ""

for service in "${SERVICES[@]}"; do
  SERVICE_PATH="services/$service"
  
  if [ ! -d "$SERVICE_PATH" ]; then
    echo -e "${YELLOW}⚠️  Service $service not found, skipping...${NC}"
    continue
  fi

  echo ""
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}🔧 Processing: $service${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  cd "$SERVICE_PATH" || exit 1

  # Install dependencies if node_modules doesn't exist
  if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install > /dev/null 2>&1
    if [ $? -ne 0 ]; then
      echo -e "${RED}❌ npm install failed for $service${NC}"
      FAILED=$((FAILED + 1))
      cd - > /dev/null
      continue
    fi
  fi

  # Run ESLint
  echo -e "${YELLOW}🔍 Running ESLint...${NC}"
  npm run lint:check > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ ESLint passed${NC}"
  else
    echo -e "${RED}❌ ESLint failed${NC}"
    npm run lint:check
    FAILED=$((FAILED + 1))
  fi

  # Run Jest tests
  echo -e "${YELLOW}🧪 Running Unit Tests...${NC}"
  npm test > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Tests passed${NC}"
  else
    echo -e "${RED}❌ Tests failed${NC}"
    npm test
    FAILED=$((FAILED + 1))
  fi

  PASSED=$((PASSED + 1))
  cd - > /dev/null
done

echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📊 Summary${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "Services processed: ${#SERVICES[@]}"
echo "Passed: $PASSED"
echo "Failed: $FAILED"

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All tests and linting passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests or linting failed!${NC}"
  exit 1
fi
