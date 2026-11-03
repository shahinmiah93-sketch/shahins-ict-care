@echo off
title Shahin's ICT Care - Publish to Cloudflare
cd /d "%~dp0cloudflare"
if not exist node_modules\wrangler\bin\wrangler.js (
  echo Installing Cloudflare deployment tools...
  call npm ci --no-fund --no-audit
  if errorlevel 1 goto failed
)
node scripts\publish.mjs
if errorlevel 1 goto failed
echo.
echo Website published. Keep the URL shown above.
pause
exit /b 0
:failed
echo.
echo Publishing stopped. Your local website and data have not been changed.
pause
exit /b 1
