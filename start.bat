@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
cd /d "%ROOT%"

set "DOCKER_WEB_PORT=8758"
set "DEV_WEB_PORT=5173"

where docker >nul 2>nul
if %errorlevel%==0 (
  docker info >nul 2>nul
  if %errorlevel%==0 (
    call :check_port %DOCKER_WEB_PORT% "Docker stack"
    if errorlevel 1 exit /b 1
    echo Starting Manim Motion with Docker...
    echo Open http://localhost:%DOCKER_WEB_PORT% in your browser.
    start "" "http://localhost:%DOCKER_WEB_PORT%"
    docker compose up --build
    exit /b %errorlevel%
  )
  echo Docker CLI found, but the Docker engine is not ready.
  echo Falling back to editor-only mode.
)

where npm >nul 2>nul
if not %errorlevel%==0 (
  echo Docker and npm were not found on PATH.
  echo Install Docker Desktop for the full stack or Node.js for editor-only mode.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing root dependencies...
  call npm install
  if errorlevel 1 exit /b %errorlevel%
)

call :check_port %DEV_WEB_PORT% "editor-only dev server"
if errorlevel 1 exit /b 1

echo Starting editor-only dev server...
echo Open http://localhost:%DEV_WEB_PORT% in your browser.
start "" "http://localhost:%DEV_WEB_PORT%"
call npm --workspace services/web run dev -- --host 0.0.0.0 --port %DEV_WEB_PORT%

exit /b %errorlevel%

:check_port
set "PORT=%~1"
set "TARGET=%~2"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p = %PORT%; $busy = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue; if ($busy) { Write-Host ('Port ' + $p + ' is already in use. Stop the process using it before starting ' + '%TARGET%' + '.'); exit 1 }"
if errorlevel 1 exit /b 1
exit /b 0
