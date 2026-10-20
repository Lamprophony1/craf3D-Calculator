param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$previewRoot = Join-Path $projectRoot '.artifacts/local-preview'
$apiRoot = Join-Path $previewRoot 'api'
$apiDll = Join-Path $apiRoot 'PrintCost.Api.dll'
$viteScript = Join-Path $projectRoot 'web/node_modules/vite/bin/vite.js'
$statePath = Join-Path $previewRoot 'processes.json'
$dotnetPath = 'C:/Program Files/dotnet/dotnet.exe'
$nodePath = Join-Path $projectRoot '.tools/node-v24.19.0-win-x64/node.exe'
New-Item -ItemType Directory -Path $previewRoot,(Join-Path $previewRoot 'data'),(Join-Path $previewRoot 'keys') -Force | Out-Null

function Get-OwnedProcess($processId, $expectedCommand) {
    if (-not $processId) { return $null }
    $candidate = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
    if ($candidate -and $candidate.CommandLine -and $candidate.CommandLine.Contains($expectedCommand)) { return $candidate }
    return $null
}
$previous = if (Test-Path -LiteralPath $statePath) { Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json } else { $null }
$apiProcess = if ($previous) { Get-OwnedProcess $previous.apiPid $apiDll } else { $null }
$webProcess = if ($previous) { Get-OwnedProcess $previous.webPid $viteScript } else { $null }
if ($apiProcess) { Stop-Process -Id $apiProcess.ProcessId; Wait-Process -Id $apiProcess.ProcessId -ErrorAction SilentlyContinue }
foreach ($port in @(5080,5173)) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    if ($listener -and -not ($port -eq 5173 -and $webProcess -and $listener.OwningProcess -contains $webProcess.ProcessId)) {
        throw "El puerto $port está ocupado por un proceso ajeno al preview registrado; no se detuvo."
    }
}
$env:DOTNET_CLI_HOME = Join-Path $projectRoot '.dotnet-home'
$env:NUGET_PACKAGES = Join-Path $projectRoot '.nuget/packages'
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = '1'
if (-not $SkipBuild) {
    & $dotnetPath publish (Join-Path $projectRoot 'src/PrintCost.Api/PrintCost.Api.csproj') --no-restore -o $apiRoot --verbosity quiet *> (Join-Path $previewRoot 'publish.log')
    if ($LASTEXITCODE -ne 0) { throw "Falló la compilación local. Revisar $previewRoot/publish.log" }
}
if (-not (Test-Path -LiteralPath $apiDll)) { throw 'Falta la compilación local de la API.' }
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:ASPNETCORE_URLS = 'http://127.0.0.1:5080'
$env:ConnectionStrings__PrintCost = 'Data Source=' + (Join-Path $previewRoot 'data/printcost.db')
$env:Auth__Mode = 'DevSelector'
$env:Auth__CookieSecure = 'false'
$env:Auth__DataProtectionKeysPath = Join-Path $previewRoot 'keys'
$api = Start-Process -FilePath $dotnetPath -ArgumentList @(('"' + $apiDll + '"')) -WorkingDirectory $apiRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $previewRoot 'api.log') -RedirectStandardError (Join-Path $previewRoot 'api-error.log')
if (-not $webProcess) {
    # Force this preview to use its own loopback API, including in environments with Vite overrides.
    $env:VITE_API_BASE_URL = 'http://127.0.0.1:5173'
    $web = Start-Process -FilePath $nodePath -ArgumentList @(('"' + $viteScript + '"'),'--host','127.0.0.1','--port','5173','--strictPort') -WorkingDirectory (Join-Path $projectRoot 'web') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $previewRoot 'web.log') -RedirectStandardError (Join-Path $previewRoot 'web-error.log')
    $webProcessId = $web.Id
} else { $webProcessId = $webProcess.ProcessId }
$state = @{ apiPid = $api.Id; webPid = $webProcessId; web = 'http://127.0.0.1:5173'; api = 'http://127.0.0.1:5080'; data = (Join-Path $previewRoot 'data/printcost.db') }
$state | ConvertTo-Json | Set-Content -Encoding utf8 -LiteralPath $statePath
$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
        $health = Invoke-RestMethod -Uri 'http://127.0.0.1:5080/health' -TimeoutSec 2
        $page = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173/jobs' -TimeoutSec 2
        if ($health.status -eq 'ok' -and $page.StatusCode -eq 200 -and $page.Content.Contains('/src/main.tsx')) { $ready = $true; break }
    } catch { Start-Sleep -Milliseconds 300 }
}
if (-not $ready) { throw "El preview no respondió. Revisar los logs de $previewRoot" }
[pscustomobject]@{ Web = $state.web; Pedidos = $state.web + '/jobs'; API = $state.api; Healthy = $ready; ApiPid = $api.Id; WebPid = $webProcessId } | ConvertTo-Json
