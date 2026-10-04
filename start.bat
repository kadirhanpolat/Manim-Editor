@echo off
setlocal EnableExtensions

rem Manim Motion launcher.
rem   start.bat              start the Docker stack (or the editor-only dev server)
rem   start.bat doctor       diagnose Docker, ports, services, Redis and workers
rem   start.bat logs         write a shareable log bundle to support-logs\
rem   start.bat repair NAME  run a known fix: node-modules ^| workers ^| redis

set "ROOT=%~dp0"
cd /d "%ROOT%"

set "DOCKER_WEB_PORT=8758"
set "API_PORT=3000"
set "DEV_WEB_PORT=5173"

if /i "%~1"=="doctor" goto :support
if /i "%~1"=="logs" goto :support
if /i "%~1"=="repair" goto :support

rem NOTE: plain "if errorlevel" checks, not %errorlevel% inside ( ) blocks:
rem cmd expands %errorlevel% when it parses a block, so it would be stale.
where docker >nul 2>nul
if errorlevel 1 goto :editor_only

docker info >nul 2>nul
if errorlevel 1 (
  echo Docker is installed, but the Docker engine is not running.
  echo Start Docker Desktop, wait for "Engine running", then run start.bat again.
  echo Continuing in editor-only mode ^(no server rendering^)...
  echo.
  goto :editor_only
)

rem Already running? Just open the editor instead of failing on our own ports.
set "STACK_UP="
for /f "delims=" %%s in ('docker compose ps --status running --services 2^>nul') do (
  if /i "%%s"=="web" set "STACK_UP=1"
)
if defined STACK_UP (
  echo Manim Motion is already running.
  echo Open http://localhost:%DOCKER_WEB_PORT% in your browser.
  start "" "http://localhost:%DOCKER_WEB_PORT%"
  echo Follow the logs with: docker compose logs -f
  exit /b 0
)

call :check_port %DOCKER_WEB_PORT% "the editor"
if errorlevel 1 goto :port_busy
call :check_port %API_PORT% "the API"
if errorlevel 1 goto :port_busy

echo Starting Manim Motion with Docker...
echo Open http://localhost:%DOCKER_WEB_PORT% in your browser.
start "" "http://localhost:%DOCKER_WEB_PORT%"
docker compose up --build
if errorlevel 1 (
  echo.
  echo The stack stopped with an error.
  echo   Diagnose it:        start.bat doctor
  echo   Collect the logs:   start.bat logs
  exit /b 1
)
exit /b 0

:editor_only
where npm >nul 2>nul
if errorlevel 1 (
  echo Neither Docker nor npm was found on PATH.
  echo Install Docker Desktop for the full stack, or Node.js 20+ for editor-only mode.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing root dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

call :check_port %DEV_WEB_PORT% "the editor-only dev server"
if errorlevel 1 goto :port_busy

echo Starting editor-only dev server...
echo Open http://localhost:%DEV_WEB_PORT% in your browser.
start "" "http://localhost:%DEV_WEB_PORT%"
call npm --workspace services/web run dev -- --host 0.0.0.0 --port %DEV_WEB_PORT%
exit /b %errorlevel%

:port_busy
echo.
echo Stop that program ^(Task Manager, Details tab, find the PID^), then run start.bat again.
echo Still stuck? Run: start.bat doctor
exit /b 1

:support
where node >nul 2>nul
if errorlevel 1 (
  echo "start.bat %~1" needs Node.js 20+ on PATH.
  exit /b 1
)
node "%ROOT%scripts\support.mjs" %*
exit /b %errorlevel%

:check_port
set "PORT=%~1"
set "TARGET=%~2"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p = %PORT%; $busy = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue; if ($busy) { $procId = ($busy | Select-Object -First 1).OwningProcess; $name = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName; Write-Host ('Port ' + $p + ' is already in use by ' + $name + ' (PID ' + $procId + '). Stop it before starting ' + '%TARGET%' + '.'); exit 1 }"
if errorlevel 1 exit /b 1
exit /b 0
