param(
  [ValidateSet("setup", "portable")]
  [string]$Channel = "setup",

  [string]$Version = "latest",

  [string]$DownloadDirectory = "$env:USERPROFILE\Downloads",

  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$Repository = "SS000JQ/pi-desktop-app"
$ApiBase = "https://api.github.com/repos/$Repository/releases"

function Get-PiDesktopRelease {
  param([string]$RequestedVersion)

  $releaseUrl = if ($RequestedVersion -eq "latest") {
    "$ApiBase/latest"
  } else {
    "$ApiBase/tags/$RequestedVersion"
  }

  Invoke-RestMethod -Uri $releaseUrl -Headers @{
    "User-Agent" = "pi-desktop-installer"
    "Accept" = "application/vnd.github+json"
  }
}

function Select-PiDesktopAsset {
  param(
    [object]$Release,
    [string]$RequestedChannel
  )

  $pattern = if ($RequestedChannel -eq "portable") {
    "^Pi-Desktop-Portable-.*\.exe$"
  } else {
    "^Pi-Desktop-Setup-.*\.exe$"
  }

  $asset = $Release.assets | Where-Object { $_.name -match $pattern } | Select-Object -First 1

  if (-not $asset) {
    throw "Could not find a $RequestedChannel Windows asset in release $($Release.tag_name)."
  }

  $asset
}

function Save-PiDesktopAsset {
  param(
    [object]$Asset,
    [string]$TargetDirectory
  )

  New-Item -ItemType Directory -Force -Path $TargetDirectory | Out-Null
  $targetPath = Join-Path $TargetDirectory $Asset.name

  Write-Host "Downloading $($Asset.name) to $targetPath"

  Invoke-WebRequest -Uri $Asset.browser_download_url -OutFile $targetPath -Headers @{
    "User-Agent" = "pi-desktop-installer"
  }

  $targetPath
}

$release = Get-PiDesktopRelease -RequestedVersion $Version
$asset = Select-PiDesktopAsset -Release $release -RequestedChannel $Channel

if ($DryRun) {
  Write-Host "Pi Desktop release found: $($release.tag_name)"
  Write-Host "Selected asset: $($asset.name)"
  Write-Host "Download URL: $($asset.browser_download_url)"
  return
}

$downloadedPath = Save-PiDesktopAsset -Asset $asset -TargetDirectory $DownloadDirectory

Write-Host ""
Write-Host "Pi Desktop $($release.tag_name) downloaded successfully."
Write-Host "File: $downloadedPath"

if ($Channel -eq "setup") {
  Write-Host "Run the installer to complete setup."
} else {
  Write-Host "Run the portable executable whenever you want to start Pi Desktop."
}
