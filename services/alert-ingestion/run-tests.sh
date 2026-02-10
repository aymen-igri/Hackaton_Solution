#!/bin/bash

# Test Runner Script for Alert Ingestion Service
# This script runs all tests and generates coverage report

echo "=========================================="
echo "  Alert Ingestion Service - Test Suite  "
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Redis is running
echo "Checking Redis connection..."
if docker exec redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis is running${NC}"
else
    echo -e "${RED}✗ Redis is not running${NC}"
    echo "Starting Redis..."
    docker-compose up -d redis
    sleep 3
fi

echo ""

# Run unit tests
echo "=========================================="
echo "  Running Unit Tests"
echo "=========================================="
npm run test:unit
UNIT_STATUS=$?

echo ""

# Run integration tests
echo "=========================================="
echo "  Running Integration Tests"
echo "=========================================="
npm run test:integration
INTEGRATION_STATUS=$?

echo ""

# Run E2E tests
echo "=========================================="
echo "  Running E2E Tests"
echo "=========================================="
npm run test:e2e
E2E_STATUS=$?

echo ""

# Run all tests with coverage
echo "=========================================="
echo "  Generating Coverage Report"
echo "=========================================="
npm test
COVERAGE_STATUS=$?

echo ""
echo "=========================================="
echo "  Test Results Summary"
echo "=========================================="

if [ $UNIT_STATUS -eq 0 ]; then
    echo -e "${GREEN}✓ Unit Tests: PASSED${NC}"
else
    echo -e "${RED}✗ Unit Tests: FAILED${NC}"
fi

if [ $INTEGRATION_STATUS -eq 0 ]; then
    echo -e "${GREEN}✓ Integration Tests: PASSED${NC}"
else
    echo -e "${RED}✗ Integration Tests: FAILED${NC}"
fi

if [ $E2E_STATUS -eq 0 ]; then
    echo -e "${GREEN}✓ E2E Tests: PASSED${NC}"
else
    echo -e "${RED}✗ E2E Tests: FAILED${NC}"
fi

if [ $COVERAGE_STATUS -eq 0 ]; then
    echo -e "${GREEN}✓ Coverage Report: GENERATED${NC}"
else
    echo -e "${RED}✗ Coverage Report: FAILED${NC}"
fi

echo ""
echo "Coverage report available at: coverage/lcov-report/index.html"
echo ""

# Exit with error if any test failed
if [ $UNIT_STATUS -ne 0 ] || [ $INTEGRATION_STATUS -ne 0 ] || [ $E2E_STATUS -ne 0 ]; then
    exit 1
fi

exit 0

