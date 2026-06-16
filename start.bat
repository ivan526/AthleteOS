@echo off
chcp 65001 >nul
echo ======================================
echo AthleteOS 一键启动脚本
echo ======================================

:: 定义端口
set BACKEND_PORT=3007
set FRONTEND_PORT=3008

echo [1/4] 正在检查并停止已运行的服务...

:: 停止占用后端端口的进程
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%BACKEND_PORT% ^| findstr LISTENING') do (
    echo 正在停止后端服务，PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)

:: 停止占用前端端口的进程
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%FRONTEND_PORT% ^| findstr LISTENING') do (
    echo 正在停止前端服务，PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)

:: 停止所有Node.js相关进程（可选）
:: taskkill /F /IM node.exe >nul 2>&1

echo [2/4] 正在启动后端服务...
cd backend
start "AthleteOS 后端服务" cmd /k "npm run start:dev"
cd ..

:: 等待后端启动
timeout /t 3 /nobreak >nul

echo [3/4] 正在启动前端服务...
cd frontend
start "AthleteOS 前端服务" cmd /k "npm run dev"
cd ..

echo [4/4] 服务启动完成！
echo ======================================
echo 后端地址: http://localhost:%BACKEND_PORT%
echo 前端地址: http://localhost:%FRONTEND_PORT%
echo ======================================
echo 两个命令窗口分别对应前后端服务，请勿关闭
echo 要停止服务直接关闭两个窗口即可
pause
