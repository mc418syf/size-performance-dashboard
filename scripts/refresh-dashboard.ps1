param(
  [string]$WorkbookFolder = "workbooks",
  [string]$OutputPath = "data\dashboard-data.json",
  [string]$Pattern = "*.xlsx"
)

$root = Split-Path -Parent $PSScriptRoot
$folderPath = if ([System.IO.Path]::IsPathRooted($WorkbookFolder)) {
  $WorkbookFolder
} else {
  Join-Path $root $WorkbookFolder
}

if (-not (Test-Path $folderPath)) {
  New-Item -ItemType Directory -Force -Path $folderPath | Out-Null
  Write-Output "Created $folderPath"
  Write-Output "Add weekly .xlsx files there, then run this script again."
  exit 0
}

$workbooks = Get-ChildItem -LiteralPath $folderPath -Filter $Pattern |
  Where-Object { $_.Name -notlike "~$*" } |
  Sort-Object Name

if ($workbooks.Count -eq 0) {
  Write-Output "No files matching $Pattern found in $folderPath"
  Write-Output "Copy weekly or multi-week .xlsx files into that folder, then run again."
  exit 1
}

$output = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
  $OutputPath
} else {
  Join-Path $root $OutputPath
}

& (Join-Path $PSScriptRoot "export-dashboard-data.ps1") -WorkbookPath @($workbooks.FullName) -OutputPath $output
