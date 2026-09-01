@echo off
setlocal

cd /d "%~dp0"

if not exist "%~dp0poultry-backend\node_modules" (
    echo Installing backend dependencies...
    call npm install --prefix "%~dp0poultry-backend"
) else (
    echo Backend dependencies already installed.
)

if not exist "%~dp0poultry-frontend\node_modules" (
    echo Installing frontend dependencies...
    call npm install --prefix "%~dp0poultry-frontend"
) else (
    echo Frontend dependencies already installed.
)

start "" /D "%~dp0poultry-backend" cmd /k "npm start"
start "" /D "%~dp0poultry-frontend" cmd /k "npm run dev"

echo.
echo Full stack started.
echo Backend: http://127.0.0.1:3000
echo Frontend: http://localhost:5173

echo.
echo Close the terminal windows when you are done.
exit /b 0
