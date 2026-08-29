@echo off
title Math Adventures - Local Server
echo Starting Math Adventures...
echo.
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Node.js was not found on this computer.
    echo Please install it from https://nodejs.org ^(the LTS version^), then run this file again.
    pause
    exit /b 1
)
node "%~dp0server.js"
pause
