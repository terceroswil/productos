@echo off
chcp 65001 >nul
title Los Caseritos - Cambiar una clave
color 0E
cd /d "%~dp0"
node herramientas\cambiar-clave.cjs
echo.
pause
