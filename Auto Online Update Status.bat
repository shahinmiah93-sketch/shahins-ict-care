@echo off
title Shahin's ICT Care - Online update status
cd /d "%~dp0"
node scripts\online-sync.mjs status
pause
