@echo off
echo Starting Test Planner Agent...
echo.

:: Start backend in a new window
start "Backend - FastAPI (port 8000)" cmd /k "cd /d "%~dp0" && C:\Users\SmrutiranjanMaharana\AppData\Local\Programs\Python\Python314\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

:: Wait 2 seconds for backend to initialize
timeout /t 2 /nobreak >nul

:: Start frontend in a new window
start "Frontend - React (port 5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Both servers are starting in separate windows.
echo.
echo   UI:      http://localhost:5173
echo   API:     http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo.
echo Close the two terminal windows to stop the servers.
pause
