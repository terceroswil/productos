@echo off
chcp 65001 >nul
title Los Caseritos - Tienda + Inventario
color 0B
cd /d "%~dp0"

echo ========================================================
echo   🧺 LOS CASERITOS - Tienda e Inventario
echo ========================================================
echo.

rem ── ¿Ya estaba prendida? ───────────────────────────────
rem Si el puerto ya está ocupado, node aborta con un error feo
rem (EADDRINUSE) y la ventana se cierra sin que llegues a leerlo.
rem Mejor avisar en castellano y no intentar arrancar dos veces.
netstat -ano | findstr /c:":3001 " | findstr "LISTENING" >nul
if %errorlevel%==0 (
  color 0E
  echo   ⚠️  LOS CASERITOS YA ESTABA PRENDIDO
  echo.
  echo   Algo ya esta usando el 3001. Dos posibilidades:
  echo.
  echo   1. Hay otra ventana de Los Caseritos abierta. Buscala en la
  echo      barra de tareas y usa esa: no hace falta abrir esta.
  echo.
  echo   2. No hay ninguna ventana: entonces Windows la prendio sola
  echo      al encender la PC. Para que no lo haga mas, corre UNA vez:
  echo          QUITAR-ARRANQUE-AUTOMATICO.bat
  echo ========================================================
  echo.
  pause
  exit /b
)

echo 🌐 Tienda:       https://loscaseritos.com
echo 👑 Panel:        https://loscaseritos.com/panel
echo 📦 Inventario:   https://loscaseritos.com/inventario
echo.
echo 💻 En esta PC:   http://localhost:3001
echo                  http://localhost:3001/inventario
echo.
echo ========================================================
echo   NO CIERRES esta ventana mientras se este usando.
echo   Si la cerras se apaga todo: loscaseritos.com deja de
echo   funcionar y las tiendas no pueden cobrar.
echo ========================================================
echo.

rem Abre las dos pantallas un par de segundos despues, cuando el
rem servidor ya esta contestando.
start /b cmd /c "ping 127.0.0.1 -n 3 >nul && start http://localhost:3001/ && start http://localhost:3001/inventario/"
node serve.js %*

rem ── Si llegamos aca, el servidor se cayo o lo cortaste ──
echo.
color 0C
echo ========================================================
echo   ⛔ LOS CASERITOS SE APAGO
echo.
echo   loscaseritos.com va a mostrar error y el inventario no
echo   va a abrir hasta que vuelvas a abrir este mismo archivo.
echo ========================================================
echo.
pause
