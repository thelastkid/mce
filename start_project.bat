@echo off
echo ========================================================
echo Starting Multi-Cloud Infrastructure Optimizer Full-Stack
echo ========================================================
start "Multi-Cloud Optimizer Backend API" cmd /k "cd /d %~dp0\backend && python run.py"
timeout /t 2 >nul
start "Multi-Cloud Optimizer Frontend UI" cmd /k "cd /d %~dp0\frontend && call npm.cmd run dev"
echo Backend running on: http://127.0.0.1:8000
echo Frontend running on: http://localhost:3000
echo API Documentation:  http://127.0.0.1:8000/docs
