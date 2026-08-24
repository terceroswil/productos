@echo off
chcp 65001 >nul
title Los Caseritos - Tienda
color 0B
cd /d "%~dp0"

echo ========================================================
echo   🧺 LOS CASERITOS - Tienda en Ivirgarzama
echo ========================================================
echo.

rem ── ¿Ya estaba prendida? ───────────────────────────────
rem Si el puerto ya está ocupado, node aborta con un error feo
rem (EADDRINUSE) y la ventana se cierra sin que llegues a leerlo.
rem Mejor avisar en castellano y no intentar arrancar dos veces.
netstat -ano | findstr /c:":4100 " | findstr "LISTENING" >nul
if %errorlevel%==0 (
  color 0E
  echo   ⚠️  LA TIENDA YA ESTABA ABIERTA
  echo.
  echo   Hay otra ventana de Los Caseritos corriendo en el 4100.
  echo   Buscala en la barra de tareas: se llama "Los Caseritos - Tienda".
  echo.
  echo   No hace falta abrir esta. Ya podes cerrarla.
  echo ========================================================
  echo.
  pause
  exit /b
)

echo 🌐 En internet:   https://loscaseritos.com
echo 👑 Panel:         https://loscaseritos.com/panel
echo 💻 En esta PC:    http://localhost:4100
echo.
echo ========================================================
echo   NO CIERRES esta ventana mientras la tienda este en uso.
echo   Si la cerras, loscaseritos.com deja de funcionar.
echo ========================================================
echo.

start http://localhost:4100/
node serve.js

rem ── Si llegamos aca, el servidor se cayo o lo cortaste ──
echo.
color 0C
echo ========================================================
echo   ⛔ LA TIENDA SE APAGO
echo.
echo   loscaseritos.com va a mostrar error hasta que la
echo   vuelvas a abrir con este mismo archivo.
echo ========================================================
echo.
pause
