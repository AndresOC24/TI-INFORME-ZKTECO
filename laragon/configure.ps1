#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$apacheRoot = 'C:\laragon\bin\apache\httpd-2.4.66-260223-Win64-VS18'
$apache = Join-Path $apacheRoot 'bin/httpd.exe'
$apacheConfig = Join-Path $apacheRoot 'conf/httpd.conf'
$site = 'C:\laragon\etc\apache2\sites-enabled\ti-informe-zkteco.conf'
$procfile = 'C:\laragon\usr\Procfile'
$backup = Join-Path $projectRoot ('.astro/laragon-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Start-Transcript -Path (Join-Path $projectRoot '.astro/laragon-configure.log') -Force
try {
    if (-not (Get-NetIPAddress -IPAddress '192.168.14.100' -ErrorAction SilentlyContinue)) {
        throw 'Este equipo no tiene asignada la IP 192.168.14.100.'
    }
    Copy-Item -LiteralPath $site -Destination (Join-Path $backup 'ti-informe-zkteco.conf')
    Copy-Item -LiteralPath $procfile -Destination (Join-Path $backup 'Procfile')
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'ti-informe-zkteco.conf') -Destination $site
    & $apache -t -f $apacheConfig
    if ($LASTEXITCODE -ne 0) {
        Copy-Item -LiteralPath (Join-Path $backup 'ti-informe-zkteco.conf') -Destination $site
        throw 'Apache rechazo la configuracion; se restauro la anterior.'
    }

    $startup = 'TI-INFORME-ZKTECO API: autorun "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ' +
        (Join-Path $PSScriptRoot 'start-server.ps1') + '" PWD=' + $projectRoot
    $lines = Get-Content -LiteralPath $procfile | Where-Object { $_ -notmatch '^TI-INFORME-ZKTECO(?: API)?:' }
    @($lines; $startup) | Set-Content -LiteralPath $procfile -Encoding UTF8

    $rule = Get-NetFirewallRule -Name 'TI-INFORME-ZKTECO-9091' -ErrorAction SilentlyContinue
    if ($rule) {
        Set-NetFirewallRule -Name 'TI-INFORME-ZKTECO-9091' -Enabled True -Direction Inbound `
            -Action Allow -Profile Any -Protocol TCP -LocalPort 9091 `
            -LocalAddress '192.168.14.100' -RemoteAddress LocalSubnet | Out-Null
    } else {
        New-NetFirewallRule -Name 'TI-INFORME-ZKTECO-9091' -DisplayName 'TI-INFORME-ZKTECO-9091' `
            -Enabled True -Direction Inbound -Action Allow -Profile Any -Protocol TCP `
            -LocalPort 9091 -LocalAddress '192.168.14.100' -RemoteAddress LocalSubnet | Out-Null
    }

    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'start-server.ps1') -Restart
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar la API.' }
    # Laragon ejecuta Apache como proceso, no como servicio Apache2.4.
    Start-Process -FilePath 'C:\laragon\laragon.exe' -ArgumentList 'reload apache' -WindowStyle Hidden
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($attempt -eq 10) {
            $apacheProcesses = Get-CimInstance Win32_Process -Filter "Name = 'httpd.exe'" |
                Where-Object { $_.ExecutablePath -eq $apache }
            if (-not $apacheProcesses) {
                Start-Process -FilePath $apache -ArgumentList ('-f "' + $apacheConfig + '"') `
                    -WorkingDirectory $apacheRoot -WindowStyle Hidden
            }
        }
        try {
            $response = Invoke-WebRequest 'http://192.168.14.100:9091/' -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $ready) { throw 'Apache no respondio en 192.168.14.100:9091 tras recargar Laragon.' }
    $apiResponse = Invoke-RestMethod 'http://192.168.14.100:9091/api/archivos' -TimeoutSec 30
    if (-not $apiResponse.tipos.bd) { throw 'La API no respondio correctamente a traves de Apache.' }
    Write-Output 'Configuracion instalada: http://192.168.14.100:9091'
    Write-Output "Copia de seguridad: $backup"
    Get-NetFirewallRule -Name 'TI-INFORME-ZKTECO-9091' | Format-List Name,Enabled,Direction,Action
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
    throw
} finally {
    Stop-Transcript
}
