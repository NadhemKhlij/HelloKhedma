# Updates "minutes" and "lessonCount" of every course in content/courses/index.json from its course file, with the
# same formula as js/coursetime.js (keep both in sync; the smoke test "course index matches the course files" fails
# when they differ). Run after adding or extending a course. No Node needed.
# Usage (repo root): powershell -File scripts/course-times.ps1 -Root .
param([string]$Root = ".")
$ErrorActionPreference = "Stop"
$READ_WPM = 200; $CODE_LPM = 6; $TRY_EXAMPLE = 5; $PER_EXERCISE = 10; $PER_INTERVIEW = 2; $QUIZ_AND_CARDS = 15
function Words($s) { if (-not $s) { 0 } else { @(([string]$s) -split '\s+' | Where-Object { $_ }).Count } }
function Count($x) { if ($null -eq $x) { 0 } else { @($x).Count } }

function CourseMinutes($c) {
  $total = 0
  foreach ($l in @($c.lessons)) {
    $w = 0
    foreach ($s in @($l.text) + @($l.points) + @($l.example.note)) { $w += Words $s }
    $code = if ($l.example.code) { ([string]$l.example.code).Split("`n").Count } else { 0 }
    $reading = [math]::Max(2, [math]::Ceiling($w / $READ_WPM + $code / $CODE_LPM))
    $total += $reading + $(if ($l.example) { $TRY_EXAMPLE } else { 0 })
  }
  $total += (Count $c.exercises) * $PER_EXERCISE + (Count $c.interview) * $PER_INTERVIEW
  if ((Count $c.cheatsheet) -gt 0) { $total += $QUIZ_AND_CARDS }
  $total
}

$indexPath = (Resolve-Path "$Root\content\courses\index.json").Path
$utf8 = [Text.UTF8Encoding]::new($false)
$values = @{}
Get-ChildItem "$Root\content\courses\*.json" | Where-Object { $_.Name -ne "index.json" } | ForEach-Object {
  $c = [IO.File]::ReadAllText($_.FullName, $utf8) | ConvertFrom-Json
  $values[$_.BaseName] = @((CourseMinutes $c), (Count $c.lessons))
}
$id = $null; $changed = 0
$lines = [IO.File]::ReadAllLines($indexPath, $utf8) | ForEach-Object {
  if ($_ -match '"id": "([^"]+)"') { $id = $Matches[1] }
  if ($id -and $values.ContainsKey($id) -and $_ -match '"minutes": \d+') {
    $v = $values[$id]
    $new = $_ -replace '"minutes": \d+', ('"minutes": ' + $v[0]) -replace '"lessonCount": \d+', ('"lessonCount": ' + $v[1])
    if ($new -ne $_) { $changed++; Write-Output "  $id -> $($v[0]) min, $($v[1]) lessons" | Out-Host }
    $new
  } else { $_ }
}
[IO.File]::WriteAllText($indexPath, (($lines -join "`n") + "`n"), $utf8)
Write-Output "index.json: $changed course(s) updated"
