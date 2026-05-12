@echo off
echo.
echo  ==========================================
echo   CrypTalk - Starting backend + ngrok
echo  ==========================================
echo.

:: Check .env exists
if not exist "backend\.env" (
  echo  ERROR: backend\.env not found!
  echo  Run: copy backend\.env.example backend\.env
  echo  Then add your JWT_SECRET
  pause
  exit /b 1
)

:: Start backend in new window
start "CrypTalk Backend" cmd /k "cd /d %~dp0backend && npm start"

:: Wait 2 seconds for backend to boot
timeout /t 2 /nobreak > nul

:: Start ngrok - reads domain from config or prompts
if exist "ngrok-domain.txt" (
  set /p DOMAIN=<ngrok-domain.txt
  start "ngrok Tunnel" cmd /k "ngrok http --url=%DOMAIN% 3001"
) else (
  echo.
  echo  Enter your ngrok domain (e.g. quench-preteen-catalyze.ngrok-free.dev):
  set /p DOMAIN="> "
  echo %DOMAIN%> ngrok-domain.txt
  start "ngrok Tunnel" cmd /k "ngrok http --url=%DOMAIN% 3001"
)

echo.
echo  Both windows started!
echo  Frontend: https://dhairyaozaa.github.io/cryptalk/
echo.
pause
