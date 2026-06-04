@echo off
echo.
echo  ==========================================
echo    VidNova Server - Starting...
echo  ==========================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo  ERROR: Node.js not found!
  echo  Please install from: https://nodejs.org
  pause
  exit /b
)

:: Install dependencies if node_modules missing
if not exist "node_modules" (
  echo  Installing dependencies...
  npm install
  echo  Done!
  echo.
)

echo  Server starting at http://localhost:3000
echo  Admin Panel     at http://localhost:3000/admin.html
echo.
echo  Admin Login:
echo    Email:    chintan@vidnova
echo    Password: upload@2410
echo.
echo  Press Ctrl+C to stop the server
echo.

:: Open browser automatically after 2 seconds
start "" timeout /t 2 >nul & start "" "http://localhost:3000"

:: Start server
node server.js

pause
