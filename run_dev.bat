@echo off
title Modern Food Service - Launcher
echo ===================================================
echo   Starting Bistro Moderne Fullstack Services
echo ===================================================

echo [1/2] Launching FastAPI Backend on http://localhost:8000 ...
start "Modern Food Service - Backend API" cmd /k "cd /d %~dp0backend && .\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"

echo [2/2] Launching Next.js 14 Frontend on http://localhost:3000 ...
start "Modern Food Service - Frontend UI" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo All services launched!
echo - Customer Menu:    http://localhost:3000
echo - Kitchen Admin:    http://localhost:3000/admin/login
echo - API Docs:         http://localhost:8000/docs
echo.
pause
