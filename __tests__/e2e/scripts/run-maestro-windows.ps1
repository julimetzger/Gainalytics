param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,

  [Parameter(Mandatory = $false)]
  [string]$SuitePath,

  [Parameter(Mandatory = $false)]
  [string]$ReportPath,

  [Parameter(Mandatory = $false)]
  [string]$FixturePath,

  [Parameter(Mandatory = $false)]
  [ValidateSet("full", "smoke", "build", "bootstrap")]
  [string]$Mode = "full",

  [Parameter(Mandatory = $false)]
  [string]$AppId = "com.powerliftingworkoutplanner"
)

$ErrorActionPreference = "Stop"

function Assert-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' not found in Windows PATH."
  }
}

function Assert-AndroidDevice {
  $deviceLines = adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\sdevice$" }
  if (-not $deviceLines -or $deviceLines.Count -eq 0) {
    throw "No Android device/emulator in 'device' state found via adb."
  }
}

if ($Mode -eq "build") {
  Push-Location (Join-Path $RepoRoot "android")
  try {
    & .\gradlew.bat installDebug
    if ($LASTEXITCODE -ne 0) {
      throw "gradlew installDebug failed with exit code $LASTEXITCODE"
    }
  }
  finally {
    Pop-Location
  }
  exit 0
}

Assert-Command "adb"
Assert-AndroidDevice

if ($Mode -eq "bootstrap" -or $Mode -eq "full" -or $Mode -eq "smoke") {
  if ([string]::IsNullOrWhiteSpace($FixturePath)) {
    throw "FixturePath is required for bootstrap/full/smoke mode."
  }

  adb push "$FixturePath" "/sdcard/Download/baseline.gains" | Out-Host
  adb shell am force-stop "$AppId" 2>$null | Out-Null
}

if ($Mode -eq "bootstrap") {
  exit 0
}

Assert-Command "maestro"

if ([string]::IsNullOrWhiteSpace($SuitePath)) {
  throw "SuitePath is required for full/smoke mode."
}

if (-not [string]::IsNullOrWhiteSpace($ReportPath)) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ReportPath) | Out-Null
  & maestro test "$SuitePath" --format junit --output "$ReportPath"
}
else {
  & maestro test "$SuitePath"
}

exit $LASTEXITCODE
