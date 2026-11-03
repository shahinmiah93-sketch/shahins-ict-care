@echo off
rem Removes the admin PIN / email / password so the admin panel asks for a new one. Student data is not touched.
rem (English text on purpose, see Start Website.bat)
cd /d "%~dp0"
echo.
echo  This will REMOVE the admin PIN, email and password. No student data is deleted.
echo  Next time you open the admin panel it will ask you to set them again.
echo  WARNING: if the website is online, set them again immediately.
echo  (If the website is running, restart it afterwards with "Restart Website.bat".)
echo.
choice /c YN /m " Remove the admin login now? Y = yes, N = cancel"
if errorlevel 2 exit /b 0
if exist "data\auth.json" del "data\auth.json"
echo  Admin login removed.
pause
