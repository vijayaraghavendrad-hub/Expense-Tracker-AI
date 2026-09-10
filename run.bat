@echo off
title Smart Expense Tracker
echo ============================================================
echo   Smart Expense Tracker - AI Personal Finance System
echo ============================================================
echo.

set SCRIPT_DIR=%~dp0

REM ── Build frontend/dist if it doesn't exist ──────────────────
if not exist "%SCRIPT_DIR%frontend\dist\index.html" (
    echo [1/3] Building frontend for the first time...
    cd /d "%SCRIPT_DIR%frontend"
    call npm.cmd run build
    if errorlevel 1 (
        echo ERROR: Frontend build failed. Please run "npm install" inside the frontend folder first.
        pause
        exit /b 1
    )
    echo     Frontend built successfully.
    echo.
)

REM ── Start Backend (single unified server on port 8000) ────────
echo [2/3] Starting Smart Expense Tracker on http://localhost:8000 ...
set ENABLE_AUTO_SHUTDOWN=1
start "Smart Expense Tracker" /MIN cmd /c "cd /d "%SCRIPT_DIR%backend" && set ENABLE_AUTO_SHUTDOWN=1 && "%USERPROFILE%\.local\bin\uv.exe" run uvicorn app.main:app --host 127.0.0.1 --port 8000"

REM ── Wait for backend to be ready ─────────────────────────────
echo [3/3] Waiting for server to be ready...
:WAIT_LOOP
timeout /t 1 /nobreak >nul
powershell -Command "try { Invoke-RestMethod http://localhost:8000/api/health -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 goto WAIT_LOOP

REM ── Open browser ─────────────────────────────────────────────
echo.
echo ============================================================
echo   App is live at http://localhost:8000
echo   Close the browser tab to auto-stop all servers.
echo   Press Ctrl+C here to force-stop the server window.
echo ============================================================
echo.
start "" "http://localhost:8000"
