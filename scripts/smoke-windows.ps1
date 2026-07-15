param(
  [Parameter(Mandatory = $true)]
  [string]$BundleRoot
)

$ErrorActionPreference = 'Stop'
$resolvedRoot = (Resolve-Path -LiteralPath $BundleRoot).Path
$nsis = Get-ChildItem -LiteralPath $resolvedRoot -Recurse -Filter '*.exe' | Where-Object Name -Like '*setup*' | Select-Object -First 1
$msi = Get-ChildItem -LiteralPath $resolvedRoot -Recurse -Filter '*.msi' | Select-Object -First 1
if (-not $nsis -or -not $msi) { throw 'NSIS or MSI bundle is missing.' }

function Find-InkCvExecutable {
  $roots = @($env:LOCALAPPDATA, $env:ProgramFiles, ${env:ProgramFiles(x86)}) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
  foreach ($root in $roots) {
    $candidate = Get-ChildItem -LiteralPath $root -Recurse -File -Filter 'InkCV*.exe' -ErrorAction SilentlyContinue |
      Where-Object Name -NotLike '*uninstall*' |
      Select-Object -First 1
    if ($candidate) { return $candidate.FullName }
  }
  throw 'Installed InkCV.exe was not found.'
}

function Assert-Starts([string]$Executable) {
  $process = Start-Process -FilePath $Executable -PassThru
  Start-Sleep -Seconds 8
  if ($process.HasExited) { throw "InkCV exited during startup with code $($process.ExitCode)." }
  Stop-Process -Id $process.Id -Force
}

$nsisInstall = Start-Process -FilePath $nsis.FullName -ArgumentList '/S' -Wait -PassThru
if ($nsisInstall.ExitCode -ne 0) { throw "NSIS install failed with code $($nsisInstall.ExitCode)." }
Assert-Starts (Find-InkCvExecutable)

$msiInstall = Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/i', $msi.FullName, '/qn', '/norestart') -Wait -PassThru
if ($msiInstall.ExitCode -notin @(0, 3010)) { throw "MSI install failed with code $($msiInstall.ExitCode)." }
Assert-Starts (Find-InkCvExecutable)

Write-Host 'Windows NSIS and MSI install/start smoke checks passed.'
