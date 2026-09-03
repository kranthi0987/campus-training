# Dumps the text of every slide of a PowerPoint file as JSON (title, body paragraphs, speaker
# notes, layout and PowerPoint section) so a deck file under server/seed/slides can be written
# from it. Usage (PowerShell, on a machine with PowerPoint):
#   .\scripts\extract-slides.ps1 -Pptx ".\ppts\deck.pptx" -Out ".\deck.json"
param(
  [Parameter(Mandatory = $true)][string]$Pptx,
  [Parameter(Mandatory = $true)][string]$Out
)
$ErrorActionPreference = 'Stop'
$app = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Open((Resolve-Path $Pptx).Path, $true, $false, $false)

$sections = @{}
if ($pres.SectionProperties.Count -gt 0) {
  for ($s = 1; $s -le $pres.SectionProperties.Count; $s++) {
    $first = $pres.SectionProperties.FirstSlide($s)
    $count = $pres.SectionProperties.SlidesCount($s)
    for ($k = 0; $k -lt $count; $k++) { $sections[$first + $k] = $pres.SectionProperties.Name($s) }
  }
}

function Get-Paragraphs($shape) {
  $list = @()
  if ($shape.HasTextFrame -eq -1 -and $shape.TextFrame.HasText -eq -1) {
    foreach ($p in $shape.TextFrame.TextRange.Paragraphs()) {
      $t = ($p.Text -replace '[\r\n\v]+', ' ').Trim()
      if ($t) { $list += [pscustomobject]@{ text = $t; level = $p.IndentLevel } }
    }
  }
  return $list
}

$slides = @()
foreach ($sl in $pres.Slides) {
  $title = ''
  $body = @()
  foreach ($sh in $sl.Shapes) {
    if ($sh.Type -eq 14 -and ($sh.PlaceholderFormat.Type -eq 1 -or $sh.PlaceholderFormat.Type -eq 3)) {
      # ppPlaceholderTitle / ppPlaceholderCenterTitle
      if ($sh.HasTextFrame -eq -1) { $title = ($sh.TextFrame.TextRange.Text -replace '[\r\n\v]+', ' ').Trim() }
      continue
    }
    if ($sh.HasTextFrame -eq -1) { $body += Get-Paragraphs $sh }
    if ($sh.Type -eq 6) { foreach ($g in $sh.GroupItems) { $body += Get-Paragraphs $g } }
    if ($sh.HasTable -eq -1) {
      $tbl = $sh.Table
      for ($r = 1; $r -le $tbl.Rows.Count; $r++) {
        $cells = @()
        for ($c = 1; $c -le $tbl.Columns.Count; $c++) { $cells += ($tbl.Cell($r, $c).Shape.TextFrame.TextRange.Text -replace '[\r\n\v]+', ' ').Trim() }
        $body += [pscustomobject]@{ text = ($cells -join ' | '); level = 1; table = $true }
      }
    }
  }
  $notes = ''
  if ($sl.HasNotesPage -eq -1) {
    foreach ($sh in $sl.NotesPage.Shapes) {
      if ($sh.Type -eq 14 -and $sh.PlaceholderFormat.Type -eq 2 -and $sh.HasTextFrame -eq -1) {
        $notes = ($sh.TextFrame.TextRange.Text -replace '\r', "`n").Trim()
      }
    }
  }
  $slides += [pscustomobject]@{
    index   = $sl.SlideIndex
    layout  = [int]$sl.Layout
    section = $sections[$sl.SlideIndex]
    title   = $title
    body    = $body
    notes   = $notes
  }
}
$pres.Close()
$app.Quit()
$slides | ConvertTo-Json -Depth 6 | Out-File -Encoding utf8 $Out
Write-Host ("Extracted {0} slides from {1} to {2}" -f $slides.Count, $Pptx, $Out)
