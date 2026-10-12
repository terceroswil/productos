@echo off
chcp 65001 >nul
title Los Caseritos - Inventario (Chimore - Ivirgarzama - Entre Rios)
color 0A
cd /d "%~dp0"

echo ========================================================
echo   LOS CASERITOS - Control de Inventario y Ventas
echo   Sucursales: Chimore - Ivirgarzama - Entre Rios
echo ========================================================
echo.

rem -- Verificar si el puerto 3003 ya esta ocupado --
netstat -ano | findstr /c:":3003 " | findstr "LISTENING" >nul
if %errorlevel%==0 (
  color 0E
  echo   ALERTA: EL INVENTARIO YA ESTABA ABIERTO
  echo.
  echo   Hay otra ventana del inventario corriendo en el puerto 3003.
  echo   Buscala en la barra de tareas: "Los Caseritos - Inventario".
  echo.
  echo   No hace falta abrir esta. Ya puedes cerrarla.
  echo ========================================================
  echo.
  pause
  exit /b
)

echo En esta computadora:  http://localhost:3003
echo Para abrir en red:    node inventario/servidor.js --red
echo.
echo ========================================================
echo   NO CIERRES esta ventana mientras el inventario este en uso.
echo ========================================================
echo.

rem Abre el navegador despues de 1 segundo asegurando que el servidor este listo
start /b cmd /c "ping 127.0.0.1 -n 2 >nul && start http://localhost:3003/"
node inventario/servidor.js %*

rem -- Si el servidor se detiene --
echo.
color 0C
echo ========================================================
echo   EL SERVIDOR DE INVENTARIO SE DETUVO
echo ========================================================
echo.
pause