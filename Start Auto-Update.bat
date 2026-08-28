@echo off
setlocal
cd /d "%~dp0"

echo AI Games - Auto-Update
echo =======================
echo Keep this window open while you add or remove game folders.
echo Closing this window (or pressing Ctrl+C) stops the auto-update.
echo.

where python >nul 2>nul
if %errorlevel%==0 (
    python watch_and_update.py
    goto :end
)

where py >nul 2>nul
if %errorlevel%==0 (
    py watch_and_update.py
    goto :end
)

where python3 >nul 2>nul
if %errorlevel%==0 (
    python3 watch_and_update.py
    goto :end
)

echo Could not find Python on this computer.
echo Install it from https://python.org (check "Add python.exe to PATH" during setup),
echo then double-click this file again.

:end
pause
