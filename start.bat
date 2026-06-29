@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%"

where docker >nul 2>nul
if %errorlevel%==0 (
  echo Starting Manim Motion with Docker...
  start "" "http://localhost:8758"
  docker compose up --build
  exit /b %errorlevel%
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

echo Starting editor-only dev server...
start "" "http://localhost:5173"
call npm --workspace services/web run dev -- --host 0.0.0.0 --port 5173
