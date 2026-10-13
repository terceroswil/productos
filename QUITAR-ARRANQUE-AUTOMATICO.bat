@echo off
chcp 65001 >nul
title Los Caseritos - Quitar arranque automatico
color 0E

echo ========================================================
echo   LOS CASERITOS - que NO se prenda sola al encender la PC
echo ========================================================
echo.
echo   Esto se corre UNA sola vez.
echo.
echo   Que va a pasar:
echo     - Windows deja de prender la tienda al encender la PC.
echo     - Se apaga la tienda que esta corriendo ahora sin ventana.
echo       loscaseritos.com queda APAGADO hasta que abras INICIAR.bat.
echo     - MOTO-IVIR y el tunel de Cloudflare NO se tocan.
echo.
echo   Windows te va a pedir permiso de administrador: toca "Si".
echo.
pause

powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0herramientas\quitar-arranque-tienda.ps1\"'"

echo.
echo   Se abrio otra ventana (azul) que hace el trabajo y te dice como
echo   quedo. Cuando termine, abri INICIAR.bat para prender todo.
echo.
pause
