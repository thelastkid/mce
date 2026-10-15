@echo off
echo ========================================================
echo Starting Multi-Cloud Optimizer Frontend (Vite + React)
echo URL: http://localhost:3000
echo ========================================================
cd /d "%~dp0\frontend"
call npm.cmd run dev
pause
