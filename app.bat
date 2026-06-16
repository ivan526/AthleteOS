@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: 配置
set BACKEND_PORT=3007
set FRONTEND_PORT=3008
set BACKEND_DIR=backend
set FRONTEND_DIR=frontend

:: 帮助信息
if "%1"=="" (
    echo ======================================
    echo AthleteOS 服务管理脚本
    echo ======================================
    echo 用法: app ^<命令^>
    echo 命令:
    echo   start    启动所有服务（自动停止已有服务）
    echo   stop     停止所有服务
    echo   restart  重启所有服务
    echo   status   查看服务状态
    echo   backend  仅启动后端服务
    echo   frontend 仅启动前端服务
    echo ======================================
    exit /b 0
)

:: 检查服务状态函数
:check_status
    echo 正在检查服务状态...
    echo.

    :: 检查后端
    set BACKEND_PID=
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%BACKEND_PORT% ^| findstr LISTENING') do (
        set BACKEND_PID=%%a
    )

    if defined BACKEND_PID (
        echo ✅ 后端服务运行中，端口: %BACKEND_PORT%，PID: !BACKEND_PID!
    ) else (
        echo ❌ 后端服务未运行
    )

    :: 检查前端
    set FRONTEND_PID=
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%FRONTEND_PORT% ^| findstr LISTENING') do (
        set FRONTEND_PID=%%a
    )

    if defined FRONTEND_PID (
        echo ✅ 前端服务运行中，端口: %FRONTEND_PORT%，PID: !FRONTEND_PID!
    ) else (
        echo ❌ 前端服务未运行
    )
    echo.
exit /b 0

:: 停止服务函数
:stop_services
    echo 正在停止所有服务...
    echo.

    :: 停止后端
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%BACKEND_PORT% ^| findstr LISTENING') do (
        taskkill /F /PID %%a >nul 2>&1
        echo 已停止后端服务，PID: %%a
    )

    :: 停止前端
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%FRONTEND_PORT% ^| findstr LISTENING') do (
        taskkill /F /PID %%a >nul 2>&1
        echo 已停止前端服务，PID: %%a
    )

    echo.
    echo 所有服务已停止
    echo.
exit /b 0

:: 启动后端函数
:start_backend
    echo 正在启动后端服务...
    cd %BACKEND_DIR%
    start "AthleteOS 后端服务" cmd /k "npm run start:dev"
    cd ..
    echo 后端服务已启动，端口: %BACKEND_PORT%
exit /b 0

:: 启动前端函数
:start_frontend
    echo 正在启动前端服务...
    cd %FRONTEND_DIR%
    start "AthleteOS 前端服务" cmd /k "npm run dev"
    cd ..
    echo 前端服务已启动，端口: %FRONTEND_PORT%
exit /b 0

:: 处理命令
if /i "%1"=="status" (
    call :check_status
    exit /b 0
)

if /i "%1"=="stop" (
    call :stop_services
    exit /b 0
)

if /i "%1"=="start" (
    echo ======================================
    echo 启动 AthleteOS 服务
    echo ======================================
    call :stop_services
    echo 正在启动服务...
    echo.

    call :start_backend
    timeout /t 3 /nobreak >nul
    call :start_frontend

    echo.
    echo ======================================
    echo ✅ 所有服务启动完成！
    echo 后端地址: http://localhost:%BACKEND_PORT%
    echo 前端地址: http://localhost:%FRONTEND_PORT%
    echo ======================================
    echo 两个命令窗口分别对应前后端服务，请勿关闭
    pause
    exit /b 0
)

if /i "%1"=="restart" (
    echo ======================================
    echo 重启 AthleteOS 服务
    echo ======================================
    call :stop_services
    timeout /t 1 /nobreak >nul

    call :start_backend
    timeout /t 3 /nobreak >nul
    call :start_frontend

    echo.
    echo ======================================
    echo ✅ 所有服务重启完成！
    echo 后端地址: http://localhost:%BACKEND_PORT%
    echo 前端地址: http://localhost:%FRONTEND_PORT%
    echo ======================================
    pause
    exit /b 0
)

if /i "%1"=="backend" (
    echo ======================================
    echo 仅启动后端服务
    echo ======================================
    :: 先停止已有的后端服务
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%BACKEND_PORT% ^| findstr LISTENING') do (
        taskkill /F /PID %%a >nul 2>&1
        echo 已停止旧的后端服务，PID: %%a
    )
    call :start_backend
    echo 后端服务启动完成，地址: http://localhost:%BACKEND_PORT%
    pause
    exit /b 0
)

if /i "%1"=="frontend" (
    echo ======================================
    echo 仅启动前端服务
    echo ======================================
    :: 先停止已有的前端服务
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%FRONTEND_PORT% ^| findstr LISTENING') do (
        taskkill /F /PID %%a >nul 2>&1
        echo 已停止旧的前端服务，PID: %%a
    )
    call :start_frontend
    echo 前端服务启动完成，地址: http://localhost:%FRONTEND_PORT%
    pause
    exit /b 0
)

:: 未知命令
echo 错误: 未知命令 "%1"
echo 运行 app 查看帮助信息
exit /b 1
