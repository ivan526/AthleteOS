@echo off
chcp 65001 >nul
echo ======================================
echo AthleteOS 一键停止脚本
echo ======================================

:: 定义端口
set BACKEND_PORT=3007
set FRONTEND_PORT=3008

echo 正在停止后端服务（端口 %BACKEND_PORT%）...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%BACKEND_PORT% ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
    echo 已停止后端服务，PID: %%a
)

echo 正在停止前端服务（端口 %FRONTEND_PORT%）...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%FRONTEND_PORT% ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
    echo 已停止前端服务，PID: %%a
)

:: 可选：停止所有Node.js进程
:: echo 正在停止所有Node.js进程...
:: taskkill /F /IM node.exe >nul 2>&1

echo ======================================
echo 所有服务已停止！
pause
