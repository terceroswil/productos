# ═══════════════════════════════════════════════════════════════
#  ARRANQUE AUTOMATICO — Los Caseritos + MOTO-IVIR
#
#  Correr UNA SOLA VEZ, como ADMINISTRADOR.
#
#  Deja tres cosas configuradas:
#    1. El tunel de Cloudflare arranca con Windows y se reintenta
#       solo. Es UNO SOLO para los dos sitios (motoivir.com -> 3000
#       y loscaseritos.com -> 3001), asi que con esto quedan los dos.
#    2. La tienda Los Caseritos arranca al ENCENDER la PC
#    3. La web MOTO-IVIR arranca al ENCENDER la PC
#
#  "Al encender" y no "al iniciar sesion": despues de un corte de
#  luz la PC arranca sin que nadie escriba la contraseña, y los
#  sitios tienen que subir igual.
#
#  Falta una cosa que NO se puede hacer desde Windows: que la PC
#  se encienda sola cuando vuelve la luz. Eso va en la BIOS y el
#  script te lo recuerda al final.
# ═══════════════════════════════════════════════════════════════

$ErrorActionPreference = 'Stop'

# ── ¿Somos administrador? ─────────────────────────────────────
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$pr = New-Object Security.Principal.WindowsPrincipal($id)
if (-not $pr.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host ""
  Write-Host "  Esto hay que correrlo como ADMINISTRADOR." -ForegroundColor Red
  Write-Host ""
  Write-Host "  Busca 'PowerShell' en el menu de inicio, clic derecho,"
  Write-Host "  'Ejecutar como administrador', y despues pega esta linea:"
  Write-Host ""
  Write-Host "     & '$PSCommandPath'" -ForegroundColor Yellow
  Write-Host ""
  pause
  exit 1
}

# ── Dónde está cada cosa ──────────────────────────────────────
# Se deduce de la ubicacion de este archivo, asi que si moves toda
# la carpeta de proyectos sigue funcionando.
$CASERITOS = Split-Path -Parent $PSScriptRoot          # ...\proyectos\productos
$PROYECTOS = Split-Path -Parent $CASERITOS             # ...\proyectos
$MOTOIVIR  = Join-Path $PROYECTOS 'MOTO-IVIR'

$SITIOS = @(
  @{ Tarea = 'Los Caseritos - Tienda'
     Carpeta = $CASERITOS
     Script  = 'serve.js'
     Puerto  = 3001
     Dominio = 'loscaseritos.com' }

  @{ Tarea = 'MOTO-IVIR - Web'
     Carpeta = $MOTOIVIR
     Script  = 'src\server.js'
     Puerto  = 3000
     Dominio = 'motoivir.com' }
)

$NODE = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NODE) { throw "No encuentro node.exe en el PATH." }

Write-Host ""
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host "    ARRANQUE AUTOMATICO — dos sitios" -ForegroundColor Cyan
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Node : $NODE"
Write-Host ""

# ── 1. El tunel (sirve a los dos sitios) ──────────────────────
# Estaba en Manual: corria, pero no volvia despues de un reinicio.
# 'delayed-auto' lo arranca un rato despues del encendido, asi no
# pelea con el resto. Que el internet tarde 10 minutos en volver no
# importa: cloudflared reintenta solo hasta que la conexion aparece.
$svc = Get-Service -Name Cloudflared -ErrorAction SilentlyContinue
if ($svc) {
  sc.exe config Cloudflared start= delayed-auto | Out-Null
  sc.exe failure Cloudflared reset= 86400 actions= restart/60000/restart/60000/restart/60000 | Out-Null
  if ($svc.Status -ne 'Running') { Start-Service Cloudflared }
  Write-Host "  [tunel]  Cloudflared: automatico + reintento si se cae" -ForegroundColor Green
  Write-Host "           (un solo tunel publica los dos dominios)"
} else {
  Write-Host "  [tunel]  No encontre el servicio Cloudflared." -ForegroundColor Yellow
  Write-Host "           Revisalo a mano: sin el, no se ve ninguno de los dos."
}
Write-Host ""

# ── 2. Un arranque por sitio ──────────────────────────────────
foreach ($s in $SITIOS) {
  $ruta = Join-Path $s.Carpeta $s.Script

  if (-not (Test-Path $ruta)) {
    Write-Host "  [$($s.Dominio)]  NO encontre $ruta — lo salteo." -ForegroundColor Yellow
    Write-Host ""
    continue
  }

  if (Get-ScheduledTask -TaskName $s.Tarea -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $s.Tarea -Confirm:$false
  }

  $accion   = New-ScheduledTaskAction    -Execute $NODE -Argument $s.Script -WorkingDirectory $s.Carpeta
  $disparo  = New-ScheduledTaskTrigger   -AtStartup
  $quien    = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  $opciones = New-ScheduledTaskSettingsSet `
                -MultipleInstances IgnoreNew `
                -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
                -ExecutionTimeLimit ([TimeSpan]::Zero) `
                -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
                -StartWhenAvailable

  Register-ScheduledTask -TaskName $s.Tarea `
    -Action $accion -Trigger $disparo -Principal $quien -Settings $opciones `
    -Description "Levanta $($s.Dominio) (puerto $($s.Puerto)) al encender la PC. No hace falta iniciar sesion. Si el servidor se cae, lo vuelve a levantar al minuto." | Out-Null

  Write-Host "  [$($s.Dominio)]  arranca al encender, puerto $($s.Puerto)" -ForegroundColor Green

  # ¿Lo levantamos ahora, o ya estaba andando?
  $ocupado = Get-NetTCPConnection -LocalPort $s.Puerto -State Listen -ErrorAction SilentlyContinue
  if ($ocupado) {
    Write-Host "           ya estaba corriendo, lo dejo como esta"
  } else {
    Start-ScheduledTask -TaskName $s.Tarea
    Start-Sleep -Seconds 3
    if (Get-NetTCPConnection -LocalPort $s.Puerto -State Listen -ErrorAction SilentlyContinue) {
      Write-Host "           levantado ahora: http://localhost:$($s.Puerto)"
    } else {
      Write-Host "           no levanto el $($s.Puerto). Revisa con:" -ForegroundColor Yellow
      Write-Host "           Get-ScheduledTaskInfo -TaskName '$($s.Tarea)'"
    }
  }
  Write-Host ""
}

# ── Lo que queda por hacer a mano ─────────────────────────────
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host "    FALTA UNA COSA, Y VA EN LA BIOS" -ForegroundColor Yellow
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Tu PC no se enciende sola cuando vuelve la luz."
Write-Host "  Viene apagado de fabrica. En tu ASUS TUF X570-PLUS:"
Write-Host ""
Write-Host "    1. Reinicia y apreta SUPR apenas prenda"
Write-Host "    2. F7 para el modo avanzado"
Write-Host "    3. Advanced  ->  APM Configuration"
Write-Host "    4. 'Restore AC Power Loss'  ->  ponelo en  Power On"
Write-Host "    5. F10 para guardar y salir"
Write-Host ""
Write-Host "  Sin eso, todo lo de arriba no sirve despues de un corte:"
Write-Host "  la maquina se queda apagada esperando que la prendan."
Write-Host ""
Write-Host "  Para comprobar mas adelante que sigue todo bien:"
Write-Host "    Get-ScheduledTaskInfo -TaskName 'Los Caseritos - Tienda'"
Write-Host "    Get-ScheduledTaskInfo -TaskName 'MOTO-IVIR - Web'"
Write-Host "    Get-Service Cloudflared | Select-Object Status, StartType"
Write-Host ""
pause
