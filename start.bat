@echo off
title Tea Manager - Launcher
cd /d "%~dp0"

echo ==============================================
echo      Tea Manager  (Anji Smart Tea Garden)
echo ==============================================
echo.

REM ===== Check Node.js =====
where node >nul 2>nul
if errorlevel 1 (
    echo [X] Node.js not found. Please install from: https://nodejs.org
    echo.
    pause
    exit /b 1
)
echo [OK] Node.js detected.
node -v
echo.

REM ===== Install dependencies if needed =====
if not exist "server\node_modules" (
    echo [*] First run: installing server dependencies...
    pushd "%~dp0server"
    call npm install
    popd
    if errorlevel 1 (
        echo [X] npm install failed. Check your network and retry.
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed.
    echo.
)

REM ===== Start backend in a new window =====
echo [*] Starting backend server...
start "TeaServer" /D "%~dp0server" cmd /k "npm start"

REM ===== Wait until backend is ready (max ~15s) =====
echo [*] Waiting for backend to be ready...
set /a tries=0
:waitloop
timeout /t 1 /nobreak >nul
set /a tries+=1
powershell -NoProfile -Command "try{(Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing -TimeoutSec 2).StatusCode|Out-Null;exit 0}catch{exit 1}" >nul 2>nul
if errorlevel 1 (
    if %tries% lss 15 (
        echo   ...waiting [%tries%]
        goto waitloop
    ) else (
        echo [!] Backend is slow to start. Will open the page anyway.
    )
) else (
    echo [OK] Backend is ready.
)

REM ===== Open the system in browser =====
echo [*] Opening the system in your browser...
start "" "http://localhost:3000"

echo.
echo ==============================================
echo  [OK] Launched successfully.
echo  System:   http://localhost:3000
echo ==============================================
echo.
echo  Tips:
echo   - Fill in DeepSeek API Key in Settings (first use)
echo   - Optionally fill in AMap API Key for weather/location
echo   - To stop the service, close the TeaServer window
echo.
pause
