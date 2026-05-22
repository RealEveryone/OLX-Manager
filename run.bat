@echo off
chcp 65001 > nul
title OLX Конзолен Асистент
color 0F
cls

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ГРЕШКА] Node.js не е инсталиран на този компютър!
    echo Моля, изтеглете го от: https://nodejs.org/
    pause
    exit
)

node manager.js
pause