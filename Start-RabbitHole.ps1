param([ValidateRange(1,65535)][int]$Port = 5030)
$ErrorActionPreference = 'Stop'
$rabbitState = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Rabbithole'
$rabbitSettingsPath = Join-Path $rabbitState 'settings.json'
$rabbitPython = Join-Path $rabbitState '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $rabbitSettingsPath)) { throw "Local settings are missing: $rabbitSettingsPath" }
if (-not (Test-Path -LiteralPath $rabbitPython)) { throw "Rabbit Hole's independent Python environment is missing: $rabbitPython" }
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'web\family-studio\dist\index.html'))) { throw 'Build the Rabbit Hole frontend before starting.' }
$rabbitSettings = Get-Content -LiteralPath $rabbitSettingsPath -Raw | ConvertFrom-Json
$rabbitProbe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$Port)
try { $rabbitProbe.Start() } catch { throw "Port $Port is already occupied. No service was replaced." } finally { $rabbitProbe.Stop() }
$rabbitLog = Join-Path $rabbitState 'logs'
New-Item -ItemType Directory -Force -Path $rabbitLog | Out-Null
$rabbitVariables = @{
    PYTHONPATH = (Join-Path $PSScriptRoot 'src')
    STUDIO_OPENWEBUI = $rabbitSettings.openwebui
    STUDIO_OPENWEBUI_PUBLIC = $rabbitSettings.public_openwebui
    STUDIO_COMFYUI = $rabbitSettings.comfyui
    STUDIO_DATA = $rabbitSettings.data
    STUDIO_RECIPES = $rabbitSettings.workflows
    STUDIO_SECURE_COOKIE = '0'
    STUDIO_PREVIEW = '0'
}
$rabbitPrevious = @{}
try {
    foreach ($rabbitKey in $rabbitVariables.Keys) {
        $rabbitPrevious[$rabbitKey] = [Environment]::GetEnvironmentVariable($rabbitKey,'Process')
        [Environment]::SetEnvironmentVariable($rabbitKey,[string]$rabbitVariables[$rabbitKey],'Process')
    }
    $rabbitProcess = Start-Process -FilePath $rabbitPython -ArgumentList @('-m','family_studio','--host','127.0.0.1','--port',"$Port") -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $rabbitLog 'stdout.log') -RedirectStandardError (Join-Path $rabbitLog 'stderr.log') -PassThru
    @{pid=$rabbitProcess.Id;started=$rabbitProcess.StartTime.ToUniversalTime().ToString('o');root=$PSScriptRoot;port=$Port} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $rabbitState 'process.json') -Encoding UTF8
} finally {
    foreach ($rabbitKey in $rabbitPrevious.Keys) { [Environment]::SetEnvironmentVariable($rabbitKey,$rabbitPrevious[$rabbitKey],'Process') }
}
Write-Output "Local Rabbit Hole: http://127.0.0.1:$Port"
Write-Output 'The public family app continues to run on Spark. Stop this local instance with Stop-RabbitHole.ps1.'
