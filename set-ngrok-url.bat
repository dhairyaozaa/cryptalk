@echo off
:: ─────────────────────────────────────────────────────────────
:: CrypTalk — Set your ngrok URL in one command
:: Usage: set-ngrok-url.bat https://your-domain.ngrok-free.dev
:: ─────────────────────────────────────────────────────────────

if "%1"=="" (
  echo.
  echo  Usage: set-ngrok-url.bat https://YOUR-DOMAIN.ngrok-free.dev
  echo.
  echo  Example:
  echo    set-ngrok-url.bat https://quench-preteen-catalyze.ngrok-free.dev
  echo.
  pause
  exit /b 1
)

set NGROK_URL=%1
set INDEX=frontend\index.html
set APP=frontend\app.html

echo Updating %INDEX%...
powershell -Command "(Get-Content '%INDEX%') -replace 'https://YOUR-DOMAIN\.ngrok-free\.dev', '%NGROK_URL%' | Set-Content '%INDEX%'"

echo Updating %APP%...
powershell -Command "(Get-Content '%APP%') -replace 'https://YOUR-DOMAIN\.ngrok-free\.dev', '%NGROK_URL%' | Set-Content '%APP%'"

echo.
echo Done! Both files now point to: %NGROK_URL%
echo.
echo Next steps:
echo   git add frontend/index.html frontend/app.html
echo   git commit -m "fix: set ngrok URL"
echo   git push
echo.
pause
