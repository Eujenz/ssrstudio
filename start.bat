@echo off
setlocal
cd /d "%~dp0"

echo ====================================================
echo           SSRStudio v2 - Cinema Studio Server
echo ====================================================
echo.
echo Working Directory: %CD%
echo Target URL: http://127.0.0.1:8000
echo.

where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python not found. Please install Python 3.11+ and add to PATH.
    pause
    exit /b 1
)

python -m uvicorn app.main:app --reload --port 8000

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Server exited unexpectedly.
    pause
)
