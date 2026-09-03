# Exports every slide of a PowerPoint file as slide-NN.png under public/decks/<key>/.
# Usage (PowerShell, on a machine with PowerPoint):
#   .\scripts\export-slides.ps1 -Pptx ".\Tech Refresher - Python & Automation.pptx" -Key day09-python
# Fonts the deck uses but this machine lacks (e.g. Aptos, a Microsoft 365 cloud font) export as
# garbage glyphs. They are swapped for Arial (monospace ones for Consolas) in a temporary copy
# before exporting; the original file is never modified. -Start numbers the pictures from a later
# index so two files can be merged into one deck folder.
param(
  [Parameter(Mandatory = $true)][string]$Pptx,
  [Parameter(Mandatory = $true)][string]$Key,
  [int]$Width = 1920,
  [int]$Height = 1080,
  [int]$Start = 1
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "public\decks\$Key"
New-Item -ItemType Directory -Force -Path $out | Out-Null
if ($Start -eq 1) { Get-ChildItem $out -Filter 'slide-*.png' | Remove-Item -Force }

Add-Type -AssemblyName System.Drawing
$installed = (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }
$work = Join-Path ([System.IO.Path]::GetTempPath()) ("export-" + [System.IO.Path]::GetFileName($Pptx))
Copy-Item (Resolve-Path $Pptx).Path $work -Force

$app = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Open($work, $false, $false, $false)
$missing = @(); foreach ($f in $pres.Fonts) { if ($installed -notcontains $f.Name) { $missing += $f.Name } }
foreach ($name in $missing) {
  $to = if ($name -match 'Mono|Code|Courier') { 'Consolas' } else { 'Arial' }
  $pres.Fonts.Replace($name, $to)
  Write-Host ("Font {0} is not installed; exporting with {1}" -f $name, $to)
}
$i = $Start
foreach ($s in $pres.Slides) {
  $s.Export((Join-Path $out ('slide-{0:D2}.png' -f $i)), 'PNG', $Width, $Height)
  $i++
}
$pres.Close()
$app.Quit()
Remove-Item $work -Force -ErrorAction SilentlyContinue
Write-Host ("Exported {0} slides to {1}" -f ($i - $Start), $out)
