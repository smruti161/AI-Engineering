@echo off
echo Starting TestingBuddy AI...
echo.

:: Install frontend dependencies if node_modules is missing
if not exist "%~dp0frontend\node_modules" (
    echo [Setup] node_modules not found. Running npm install...
    cd /d "%~dp0frontend"
    npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed. Please check Node.js is installed.
        pause
        exit /b 1
    )
    echo [Setup] npm install complete.
    echo.
)

:: Start backend
start "Backend - FastAPI (port 8000)" cmd /k "cd /d "%~dp0" && python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 2 /nobreak >nul

:: Start frontend
start "Frontend - React (port 5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Both servers are starting in separate windows.
echo.
echo   UI:       http://localhost:5173
echo   API:      http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo.
echo Close the terminal windows to stop the servers.
pause
