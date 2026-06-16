@echo off
echo Stopping Antigravity Bot and Watchdog...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -like '*watchdog.js*' -or $_.CommandLine -like '*telegram-bot.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
echo Done!
pause
