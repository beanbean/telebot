@echo off
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process node -ArgumentList 'src/watchdog.js' -WindowStyle Hidden -WorkingDirectory '%~dp0'"
