# Exports every slide of a PowerPoint file as slide-NN.png under public/decks/<key>/.
# Usage (PowerShell, on a machine with PowerPoint):
#   .\scripts\export-slides.ps1 -Pptx ".\Tech Refresher - Python & Automation.pptx" -Key day09-python
param(
  [Parameter(Mandatory = $true)][string]$Pptx,
  [Parameter(Mandatory = $true)][string]$Key,
  [int]$Width = 1920,
  [int]$Height = 1080
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "public\decks\$Key"
New-Item -ItemType Directory -Force -Path $out | Out-Null
Get-ChildItem $out -Filter 'slide-*.png' | Remove-Item -Force
$app = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Open((Resolve-Path $Pptx).Path, $true, $false, $false)
$i = 1
foreach ($s in $pres.Slides) {
  $s.Export((Join-Path $out ('slide-{0:D2}.png' -f $i)), 'PNG', $Width, $Height)
  $i++
}
$pres.Close()
$app.Quit()
Write-Host ("Exported {0} slides to {1}" -f ($i - 1), $out)
