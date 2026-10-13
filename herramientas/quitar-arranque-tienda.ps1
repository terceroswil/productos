# ===============================================================
#  QUITAR EL ARRANQUE AUTOMATICO DE LOS CASERITOS
#
#  Correr UNA SOLA VEZ, como ADMINISTRADOR. Lo mas facil: doble clic
#  en QUITAR-ARRANQUE-AUTOMATICO.bat, que pide el permiso solo.
#
#  Desde el 06/09/2026 Windows prendia la tienda sola al encender la
#  PC, con una tarea programada sin ventana ('Los Caseritos - Tienda').
#  El 12/10/2026 el dueno decidio abrirla el mismo con INICIAR.bat.
#
#  Que hace:
#    1. Frena y borra ESA tarea. La PC ya no prende la tienda sola.
#    2. Apaga la tienda que esa tarea dejo corriendo sin ventana,
#       para que INICIAR.bat pueda prenderla (si no, el puerto 3001
#       sigue ocupado y INICIAR.bat dice "ya estaba prendida").
#
#  Que NO toca:
#    - MOTO-IVIR: motoivir.com sigue arrancando solo como siempre.
#    - El tunel de Cloudflare: sigue automatico, lo usan los dos
#      sitios. Con la tienda apagada, loscaseritos.com muestra un
#      error de Cloudflare hasta que abras INICIAR.bat. Es lo esperado.
#
#  Todo lo que hace queda anotado en quitar-arranque.log, al lado de
#  este archivo. La primera version no anotaba nada: si la ventana se
#  cerraba por un error, no habia forma de saber que habia pasado.
#
#  Para volver atras: agregar de nuevo Los Caseritos a la lista
#  $SITIOS de arranque-automatico.ps1 y correr ese.
# ===============================================================

# OJO: PowerShell no distingue mayusculas de minusculas en los nombres.
# La primera version tenia $TAREA (el nombre) y $tarea (la tarea encontrada):
# eran la MISMA variable, la segunda pisaba a la primera y el borrado fallaba.
$NOMBRE_TAREA = 'Los Caseritos - Tienda'
$PUERTO = 3001
$LOG    = Join-Path $PSScriptRoot 'quitar-arranque.log'

function Decir($texto, $color) {
  if ($color) { Write-Host $texto -ForegroundColor $color } else { Write-Host $texto }
  Add-Content -Path $LOG -Value $texto -Encoding UTF8 -ErrorAction SilentlyContinue
}

function Esperar-Enter {
  Write-Host ""
  try { [void](Read-Host '  Enter para cerrar') } catch {}
}

Add-Content -Path $LOG -Value "`r`n===== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') =====" -Encoding UTF8 -ErrorAction SilentlyContinue

# -- Somos administrador? ---------------------------------------
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$pr = New-Object Security.Principal.WindowsPrincipal($id)
if (-not $pr.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Decir ""
  Decir "  SIN PERMISO: esto hay que correrlo como ADMINISTRADOR." Red
  Decir ""
  Decir "  Lo mas facil: doble clic en QUITAR-ARRANQUE-AUTOMATICO.bat"
  Decir "  (en la carpeta de Los Caseritos) y tocar 'Si' cuando Windows"
  Decir "  pida permiso. No se toco nada."
  Esperar-Enter
  exit 1
}

try {
  $ErrorActionPreference = 'Stop'

  Decir ""
  Decir "  ================================================" Cyan
  Decir "    LOS CASERITOS - quitar el arranque automatico" Cyan
  Decir "  ================================================" Cyan
  Decir ""

  # -- 1. La tarea programada -----------------------------------
  $encontrada = Get-ScheduledTask -TaskName $NOMBRE_TAREA -ErrorAction SilentlyContinue
  if ($encontrada) {
    # Frenarla ANTES de borrarla: tiene reintento cada minuto, y si solo
    # se mata el programa, la tarea lo vuelve a levantar.
    Stop-ScheduledTask -TaskName $NOMBRE_TAREA -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $NOMBRE_TAREA -Confirm:$false
    Decir "  [tarea]   '$NOMBRE_TAREA' borrada." Green
    Decir "            La PC ya no prende la tienda sola al encender."
  } else {
    Decir "  [tarea]   '$NOMBRE_TAREA' no existia: no habia nada que borrar." Yellow
    $otras = Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -match 'aserito|MOTO|serve' }
    foreach ($o in $otras) { Decir "            (hay otra tarea parecida: '$($o.TaskName)' en $($o.TaskPath), estado $($o.State))" }
  }
  Decir ""

  # -- 2. La tienda que quedo corriendo sin ventana -------------
  Start-Sleep -Seconds 2
  $conexion = Get-NetTCPConnection -LocalPort $PUERTO -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $conexion) {
    Decir "  [tienda]  El puerto $PUERTO quedo libre." Green
  } else {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($conexion.OwningProcess)"
    Decir "  [tienda]  En el $PUERTO hay: $($proc.Name), proceso $($proc.ProcessId), sesion $($proc.SessionId)"
    Decir "            $($proc.CommandLine)"
    # Solo se apaga si es la de la tarea: un node en la sesion 0, que es
    # donde corre lo que no tiene escritorio. Si la abriste vos con
    # INICIAR.bat tiene ventana (sesion 1 o mas) y esa NO se toca.
    if ($proc -and $proc.Name -eq 'node.exe' -and $proc.SessionId -eq 0) {
      Stop-Process -Id $proc.ProcessId -Force
      Start-Sleep -Seconds 2
      if (Get-NetTCPConnection -LocalPort $PUERTO -State Listen -ErrorAction SilentlyContinue) {
        Decir "  [tienda]  SIGUE prendida despues de apagarla: algo la vuelve a levantar." Red
      } else {
        Decir "  [tienda]  Apagada la que corria sin ventana." Green
      }
    } else {
      Decir "  [tienda]  Es una ventana tuya. No la toco: esa la manejas vos." Yellow
    }
  }

  # -- Como quedo todo ------------------------------------------
  Decir ""
  Decir "  ================================================" Cyan
  Decir "    LISTO" Green
  Decir "  ================================================" Cyan
  Decir ""
  Decir "  Ahora loscaseritos.com esta APAGADO hasta que lo abras."
  Decir ""
  Decir "  Para prenderlo: doble clic en  INICIAR.bat" Yellow
  Decir "  Prende la tienda y el inventario juntos, en una ventana."
  Decir ""
  Decir "  MOTO-IVIR y el tunel de Cloudflare no se tocaron:"
  $moto = Get-ScheduledTask -TaskName 'MOTO-IVIR - Web' -ErrorAction SilentlyContinue
  if ($moto) { Decir "    MOTO-IVIR - Web : $($moto.State)" }
  $svc = Get-Service -Name Cloudflared -ErrorAction SilentlyContinue
  if ($svc) { Decir "    Cloudflared     : $($svc.Status), $($svc.StartType)" }
}
catch {
  Decir ""
  Decir "  ALGO FALLO y no se termino:" Red
  Decir "    $($_.Exception.Message)" Red
  Decir "    en la linea $($_.InvocationInfo.ScriptLineNumber)"
  Decir ""
  Decir "  Lo que se llego a hacer esta arriba, y anotado en:"
  Decir "    $LOG"
}

Esperar-Enter
