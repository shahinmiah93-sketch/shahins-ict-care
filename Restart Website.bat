@echo off
rem Stops the website running on port 8090, then starts it again (English text on purpose, see Start Website.bat).
title Shahin's ICT Care - Restart
cd /d "%~dp0"
echo  Stopping the old website (port 8090)...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":8090 .*LISTENING"') do taskkill /PID %%p /F >nul 2>nul
timeout /t 2 /nobreak >nul
echo  Starting again...
start "Shahin's ICT Care" "%~dp0Start Website.bat"
exit /b 0
