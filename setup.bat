@echo off
cd /d "C:\Users\usuario\Documents\AFIPAssistant"

echo ============================================
echo  Configuracion permanente AFIP Assistant
echo ============================================
echo.

:: Add hosts entry (requires admin)
echo 127.0.0.1 afip >> %SystemRoot%\System32\drivers\etc\hosts
echo [OK] Hosts entry: http://afip

:: Remove old shortcut
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\AFIPAssistant.lnk" 2>nul

:: Create new shortcut on port 80
set SCRIPT="%TEMP%\create_shortcut.vbs"
echo Set WshShell = WScript.CreateObject("WScript.Shell") > %SCRIPT%
echo Set Shortcut = WshShell.CreateShortcut("%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\AFIPAssistant.lnk") >> %SCRIPT%
echo Shortcut.TargetPath = "C:\Program Files\nodejs\node.exe" >> %SCRIPT%
echo Shortcut.Arguments = "server.js" >> %SCRIPT%
echo Shortcut.WorkingDirectory = "C:\Users\usuario\Documents\AFIPAssistant" >> %SCRIPT%
echo Shortcut.Save >> %SCRIPT%
cscript //nologo %SCRIPT%
del %SCRIPT%
echo [OK] Startup shortcut created

:: Create scheduled task as backup
schtasks /create /tn "AFIPAssistant" /tr "cmd.exe /c start /B C:\ProgramData\nodejs\node.exe server.js" /ru %USERNAME% /sc onlogon /f /it >nul 2>&1
echo [OK] Scheduled task created

echo.
echo ============================================
echo  AFIP Assistant disponible en:
echo   http://afip
echo   http://localhost
echo ============================================
pause
