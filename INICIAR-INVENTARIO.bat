@echo off
chcp 65001 >nul
title Los Caseritos - Inventario (Chimoré · Ivirgarzama · Entre Ríos)
color 0A
cd /d "%~dp0"

echo ========================================================
echo   📦 LOS CASERITOS - Control de Inventario y Ventas
echo   Sucursales: Chimoré · Ivirgarzama · Entre Ríos
echo ========================================================
echo.

rem ── ¿El puerto 3003 ya está ocupado? ────────────────────
netstat -ano | findstr /c:":3003 " | findstr "LISTENING" >nul
if %errorlevel%==0 (
  color 0E
  echo   ⚠️  EL INVENTARIO YA ESTABA ABIERTO
  echo.
  echo   Hay otra ventana del inventario corriendo en el puerto 3003.
  echo   Búscala en la barra de tareas: "Los Caseritos - Inventario".
  echo.
  echo   No hace falta abrir esta. Ya puedes cerrarla.
  echo ========================================================
  echo.
  pause
  exit /b
)

echo 💻 En esta computadora:  http://localhost:3003
echo 📱 Para abrir en red:    node inventario/servidor.js --red
echo.
echo ========================================================
echo   NO CIERRES esta ventana mientras el inventario esté en uso.
echo ========================================================
echo.

start http://localhost:3003/
node inventario/servidor.js %*

rem ── Si el servidor se detiene ──
echo.
color 0C
echo ========================================================
echo   ⛔ EL SERVIDOR DE INVENTARIO SE DETUVO
echo ========================================================
echo.
pause
