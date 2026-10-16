@echo off
chcp 65001 >nul
title SSRStudio v2 Server

echo ====================================================
echo           SSRStudio v2 - Cinema Studio Server
echo ====================================================
echo.
echo [*] 工作目錄: %~dp0
echo [*] 正在啟動伺服器: http://127.0.0.1:8000
echo [*] 按 Ctrl+C 可隨時停止伺服器
echo.

cd /d "%~dp0"

:: 檢查 python 是否存在
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] 找不到 Python，請確認已安裝 Python 3.11+ 並加入 PATH 環境變數。
    pause
    exit /b 1
)

:: 啟動 Uvicorn 服務
python -m uvicorn app.main:app --reload --port 8000

if %ERRORLEVEL% neq 0 (
    echo.
    echo [INFO] 如果尚未安裝依賴，請先執行: pip install -r requirements.txt
    pause
)
