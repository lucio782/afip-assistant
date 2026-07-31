@echo off
cd /d "C:\Users\usuario\Documents\AFIPAssistant"
start "" /B "C:\Program Files\nodejs\node.exe" server.js > nul 2>&1
echo ARCA Assistant iniciado en http://afip
