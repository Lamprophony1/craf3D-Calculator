@echo off
setlocal
set "NODE_EXE=%~dp0..\..\.tools\node-v24.19.0-win-x64\node.exe"
if exist "%NODE_EXE%" goto run
where node.exe >nul 2>nul
if errorlevel 1 goto missing
set "NODE_EXE=node.exe"
:run
"%NODE_EXE%" "%~dp0ui.mjs" %*
exit /b %errorlevel%
:missing
echo Falta Node 24. Consultar tools/ui/README.md. 1>&2
exit /b 1
