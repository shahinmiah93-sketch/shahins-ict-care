@echo off
title Shahin's ICT Care - Auto Start
cd /d "%~dp0"
rem Start the website automatically when Windows starts (small launcher in the Startup folder,
rem minimized window, no browser). Run this file again to turn it off.
set "LAUNCH=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Shahins ICT Care Website.bat"
if exist "%LAUNCH%" goto ask_off
> "%LAUNCH%" echo @echo off
>> "%LAUNCH%" echo cd /d "%~dp0"
>> "%LAUNCH%" echo start "Shahin's ICT Care" /min cmd /c "node server.mjs"
echo.
echo  DONE: the website will now start by itself every time Windows starts.
echo  (Run this file again to turn it off.)
echo.
pause
exit /b 0

:ask_off
echo.
echo  Auto start is ON (the website starts when Windows starts).
choice /c YN /m " Turn it OFF? Y = turn off, N = keep on"
if errorlevel 2 exit /b 0
del "%LAUNCH%"
echo  Turned OFF. Use "Start Website.bat" to start the website yourself.
pause
