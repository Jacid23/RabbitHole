$ErrorActionPreference = 'Stop'
$rabbitSettingsPath = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Rabbithole\settings.json'
if (-not (Test-Path -LiteralPath $rabbitSettingsPath)) { throw "Local settings are missing: $rabbitSettingsPath" }
$rabbitSettings = Get-Content -LiteralPath $rabbitSettingsPath -Raw | ConvertFrom-Json
$rabbitUrl = [Uri]$rabbitSettings.public_app
if ($rabbitUrl.Scheme -notin @('https','http')) { throw 'Configure a valid public_app address in Rabbit Hole settings.' }
Start-Process -FilePath $rabbitUrl.AbsoluteUri
