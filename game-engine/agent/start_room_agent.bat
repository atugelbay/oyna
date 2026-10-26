@echo off
chcp 65001 >nul
title OYNA Room Agent
cd /d "%~dp0"

if not exist "%~dp0.env" (
  echo [!] Нет файла .env в этой папке.
  echo     Скопируйте .env.example -^> .env и заполните ROOM_ID и STATION_API_KEY.
  echo.
  pause
  exit /b 1
)

where python >nul 2>&1
if errorlevel 1 (
  where py >nul 2>&1
  if errorlevel 1 (
    echo [!] Python не найден. Установите с python.org и отметьте Add to PATH.
    pause
    exit /b 1
  )
  echo Starting Room Agent via py -3 ...
  py -3 "%~dp0room_agent.py"
) else (
  echo Starting Room Agent ...
  python "%~dp0room_agent.py"
)

echo.
echo Агент завершился. Окно можно закрыть.
pause
