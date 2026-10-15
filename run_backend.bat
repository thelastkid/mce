@echo off
echo ========================================================
echo Starting Multi-Cloud Optimizer Backend (FastAPI + ML Model)
echo API Docs: http://127.0.0.1:8000/docs
echo ========================================================
cd /d "%~dp0\backend"
python run.py
pause
