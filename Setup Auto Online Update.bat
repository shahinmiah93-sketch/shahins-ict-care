@echo off
title Shahin's ICT Care - Set up automatic online updates
cd /d "%~dp0"
node scripts\online-sync.mjs setup
if errorlevel 1 echo Setup stopped. Your website and data are unchanged. See the message above.
pause
