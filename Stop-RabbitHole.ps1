$ErrorActionPreference = 'Stop'
$rabbitState = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Rabbithole'
$rabbitRecord = Join-Path $rabbitState 'process.json'
if (-not (Test-Path -LiteralPath $rabbitRecord)) { Write-Output 'No local Rabbit Hole process is recorded.'; return }
$rabbitInfo = Get-Content -LiteralPath $rabbitRecord -Raw | ConvertFrom-Json
if (-not $rabbitInfo.pid) { Write-Output 'Local Rabbit Hole is already stopped.'; return }
$rabbitProcess = Get-Process -Id $rabbitInfo.pid -ErrorAction SilentlyContinue
if (-not $rabbitProcess) { Write-Output 'The recorded local Rabbit Hole process is no longer running.'; return }
$rabbitStarted = if ($rabbitInfo.started -is [DateTime]) { [DateTimeOffset]$rabbitInfo.started } else { [DateTimeOffset]::Parse([string]$rabbitInfo.started) }
$rabbitCommand = Get-CimInstance Win32_Process -Filter "ProcessId=$($rabbitInfo.pid)"
if ($rabbitInfo.root -ne $PSScriptRoot -or [Math]::Abs(($rabbitProcess.StartTime.ToUniversalTime() - $rabbitStarted.UtcDateTime).TotalMilliseconds) -gt 1000 -or $rabbitCommand.CommandLine -notmatch '-m\s+family_studio' -or $rabbitCommand.CommandLine -notmatch "--port\s+$($rabbitInfo.port)(\s|$)") { throw 'The recorded PID does not match this Rabbit Hole installation. Nothing was stopped.' }
$rabbitOwned = [Collections.Generic.List[int]]::new()
$rabbitOwned.Add([int]$rabbitInfo.pid)
for ($rabbitIndex=0; $rabbitIndex -lt $rabbitOwned.Count; $rabbitIndex++) {
    foreach ($rabbitChild in Get-CimInstance Win32_Process -Filter "ParentProcessId=$($rabbitOwned[$rabbitIndex])") {
        if (-not $rabbitOwned.Contains([int]$rabbitChild.ProcessId)) { $rabbitOwned.Add([int]$rabbitChild.ProcessId) }
    }
}
for ($rabbitIndex=$rabbitOwned.Count-1; $rabbitIndex -ge 0; $rabbitIndex--) { Stop-Process -Id $rabbitOwned[$rabbitIndex] -ErrorAction SilentlyContinue }
@{root=$PSScriptRoot;state='stopped';stopped=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath $rabbitRecord -Encoding UTF8
Write-Output 'Stopped only this local Rabbit Hole instance.'
