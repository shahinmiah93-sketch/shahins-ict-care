@echo off
rem Messages are in English on purpose: Bangla text inside a .bat file breaks Windows' reading of the file
rem (it then runs from the wrong folder and the website never starts).
title Shahin's ICT Care
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js is not installed. Install the LTS version from https://nodejs.org
  pause
  exit /b 1
)
echo.
echo  Starting the website... KEEP THIS WINDOW OPEN. Closing it stops the website.
echo  Local:  http://127.0.0.1:8090        Online: https://shahinictcare.com
echo.
start "" http://127.0.0.1:8090
node server.mjs
pause
