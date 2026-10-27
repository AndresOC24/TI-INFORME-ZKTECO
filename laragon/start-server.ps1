param([switch]$Restart)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$entry = Join-Path $projectRoot 'dist/server/entry.mjs'
$runtime = Join-Path $projectRoot '.astro'
$node = 'C:\laragon\bin\nodejs\node-v22\node.exe'

if (-not (Test-Path -LiteralPath $entry)) {
    throw 'Primero ejecuta npm run build desde la carpeta del proyecto.'
}
if (-not (Test-Path -LiteralPath $node)) {
    $node = (Get-Command node -ErrorAction Stop).Source
}

$listener = Get-NetTCPConnection -LocalPort 4322 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    $serverPid = ($listener | Select-Object -First 1).OwningProcess
    $server = Get-CimInstance Win32_Process -Filter "ProcessId = $serverPid"
    if (-not $server.CommandLine -or -not $server.CommandLine.Contains($entry)) {
        throw 'El puerto 4322 esta ocupado por otro proceso. No se modifico.'
    }
    if (-not $Restart) {
        Write-Output "La API ya esta iniciada (PID $serverPid)."
        exit 0
    }
    Stop-Process -Id $serverPid -Force
    Wait-Process -Id $serverPid -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$env:HOST = '127.0.0.1'
$env:PORT = '4322'
if (-not $env:ARCHIVES_DIR) { $env:ARCHIVES_DIR = Join-Path $projectRoot 'archives' }
$serverProcess = Start-Process -FilePath $node -ArgumentList ('"' + $entry + '"') `
    -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $runtime 'laragon-node.log') `
    -RedirectStandardError (Join-Path $runtime 'laragon-node-error.log')

for ($attempt = 0; $attempt -lt 30; $attempt++) {
    $serverProcess.Refresh()
    if ($serverProcess.HasExited) { throw 'Node termino. Revisa .astro/laragon-node-error.log.' }
    try {
        $response = Invoke-WebRequest 'http://127.0.0.1:4322/principal' -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            Write-Output "API iniciada en 127.0.0.1:4322 (PID $($serverProcess.Id))."
            exit 0
        }
    } catch { Start-Sleep -Milliseconds 200 }
}
throw 'Node no respondio a tiempo. Revisa los registros en .astro/laragon-node*.log.'
