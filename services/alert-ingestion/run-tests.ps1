# Test Runner Script for Windows
# Run all tests and generate coverage report

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Alert Ingestion Service - Test Suite  " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Redis is running
Write-Host "Checking Redis connection..." -ForegroundColor Yellow
try {
    $redisCheck = docker exec redis redis-cli ping 2>$null
    if ($redisCheck -eq "PONG") {
        Write-Host "✓ Redis is running" -ForegroundColor Green
    } else {
        throw "Redis not responding"
    }
} catch {
    Write-Host "✗ Redis is not running" -ForegroundColor Red
    Write-Host "Starting Redis..." -ForegroundColor Yellow
    docker-compose up -d redis
    Start-Sleep -Seconds 3
}

Write-Host ""

# Run unit tests
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Running Unit Tests" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
npm run test:unit
$unitStatus = $LASTEXITCODE

Write-Host ""

# Run integration tests
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Running Integration Tests" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
npm run test:integration
$integrationStatus = $LASTEXITCODE

Write-Host ""

# Run E2E tests
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Running E2E Tests" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
npm run test:e2e
$e2eStatus = $LASTEXITCODE

Write-Host ""

# Run all tests with coverage
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Generating Coverage Report" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
npm test
$coverageStatus = $LASTEXITCODE

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Test Results Summary" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

if ($unitStatus -eq 0) {
    Write-Host "✓ Unit Tests: PASSED" -ForegroundColor Green
} else {
    Write-Host "✗ Unit Tests: FAILED" -ForegroundColor Red
}

if ($integrationStatus -eq 0) {
    Write-Host "✓ Integration Tests: PASSED" -ForegroundColor Green
} else {
    Write-Host "✗ Integration Tests: FAILED" -ForegroundColor Red
}

if ($e2eStatus -eq 0) {
    Write-Host "✓ E2E Tests: PASSED" -ForegroundColor Green
} else {
    Write-Host "✗ E2E Tests: FAILED" -ForegroundColor Red
}

if ($coverageStatus -eq 0) {
    Write-Host "✓ Coverage Report: GENERATED" -ForegroundColor Green
} else {
    Write-Host "✗ Coverage Report: FAILED" -ForegroundColor Red
}

Write-Host ""
Write-Host "Coverage report available at: coverage\lcov-report\index.html" -ForegroundColor Yellow
Write-Host ""

# Open coverage report in browser
$openCoverage = Read-Host "Open coverage report in browser? (y/n)"
if ($openCoverage -eq "y") {
    Start-Process "coverage\lcov-report\index.html"
}

# Exit with error if any test failed
if (($unitStatus -ne 0) -or ($integrationStatus -ne 0) -or ($e2eStatus -ne 0)) {
    exit 1
}

exit 0

