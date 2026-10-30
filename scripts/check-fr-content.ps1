# Checks every French content file (content/courses/fr, content/interview/fr) against its English source: same
# array lengths, ids, themes and identical code. Usage: powershell -File scripts/check-fr-content.ps1 -Root .
# Compares every French content file with its English source: same structure (array lengths, ids, themes),
# identical code fields. Prints one line per file and the problems found.
param([string]$Root)
$ErrorActionPreference = "Stop"
$problems = 0
function Load($p) { Get-Content -Raw -Encoding UTF8 $p | ConvertFrom-Json }
function Check($name, $cond, $msg) { if (-not $cond) { $script:problems++; $script:fileProblems += "  - $msg" } }
function Len($x) { if ($null -eq $x) { 0 } else { @($x).Count } }

Get-ChildItem "$Root\content\courses\*.json" | Where-Object { $_.Name -ne "index.json" } | ForEach-Object {
  $script:fileProblems = @()
  $en = Load $_.FullName; $frPath = "$Root\content\courses\fr\$($_.Name)"
  if (-not (Test-Path $frPath)) { Write-Output "MISSING fr/$($_.Name)"; $script:problems++; return }
  $fr = Load $frPath
  Check $_ ((Len $en.lessons) -eq (Len $fr.lessons)) "lessons $(Len $en.lessons) vs $(Len $fr.lessons)"
  for ($i = 0; $i -lt (Len $en.lessons); $i++) {
    $a = $en.lessons[$i]; $b = $fr.lessons[$i]
    Check $_ ($a.minutes -eq $b.minutes) "lesson $i minutes"
    Check $_ ((Len $a.text) -eq (Len $b.text)) "lesson $i text count"
    Check $_ ((Len $a.points) -eq (Len $b.points)) "lesson $i points count"
    if ($a.example) { Check $_ ($a.example.code -ceq $b.example.code -and $a.example.lang -ceq $b.example.lang) "lesson $i example code" }
  }
  Check $_ ((Len $en.cheatsheet) -eq (Len $fr.cheatsheet)) "cheatsheet groups"
  for ($g = 0; $g -lt (Len $en.cheatsheet); $g++) { Check $_ ((Len $en.cheatsheet[$g].items) -eq (Len $fr.cheatsheet[$g].items)) "cheatsheet group $g items" }
  Check $_ ((Len $en.exercises) -eq (Len $fr.exercises)) "exercises"
  for ($e = 0; $e -lt (Len $en.exercises); $e++) {
    if ($en.exercises[$e].code) { Check $_ ($en.exercises[$e].answer -ceq $fr.exercises[$e].answer -and $en.exercises[$e].code -ceq $fr.exercises[$e].code) "exercise $e code answer" }
  }
  Check $_ ((Len $en.pitfalls) -eq (Len $fr.pitfalls)) "pitfalls"
  Check $_ ((Len $en.interview) -eq (Len $fr.interview)) "interview"
  Check $_ ($en.why -ne $fr.why) "why not translated"
  Write-Output ("{0,-22} {1}" -f "courses/$($_.Name)", $(if ($script:fileProblems.Count) { "PROBLEMS" } else { "ok" }))
  $script:fileProblems | ForEach-Object { Write-Output $_ }
}

# Course index overrides: every id exists in index.json
$idx = Load "$Root\content\courses\index.json"; $fidx = Load "$Root\content\courses\fr\index.json"
$ids = $idx | ForEach-Object { $_.id }
$fidx | ForEach-Object { if ($ids -notcontains $_.id) { Write-Output "fr/index.json: unknown id $($_.id)"; $problems++ } }
Write-Output ("{0,-22} {1}" -f "courses/fr/index.json", "$((Len $fidx))/$((Len $idx)) courses")

# Interview
$script:fileProblems = @()
$en = Load "$Root\content\interview\common.json"; $fr = Load "$Root\content\interview\fr\common.json"
$ek = ($en.themes.PSObject.Properties.Name) -join ","; $fk = ($fr.themes.PSObject.Properties.Name) -join ","
Check 1 ($ek -eq $fk) "theme keys differ"
Check 1 ((Len $en.behavioral) -eq (Len $fr.behavioral)) "behavioral count"
for ($i = 0; $i -lt (Len $en.behavioral); $i++) {
  Check 1 ($en.behavioral[$i].id -ceq $fr.behavioral[$i].id -and $en.behavioral[$i].theme -ceq $fr.behavioral[$i].theme) "behavioral $i id/theme"
  Check 1 ((Len $en.behavioral[$i].tips) -eq (Len $fr.behavioral[$i].tips)) "behavioral $i tips"
}
foreach ($k in "before", "during", "after") { Check 1 ((Len $en.checklist.$k) -eq (Len $fr.checklist.$k)) "checklist $k" }
Check 1 ((Len $en.ask) -eq (Len $fr.ask)) "ask"
Check 1 ((Len $en.salary) -eq (Len $fr.salary)) "salary"
Write-Output ("{0,-22} {1}" -f "interview/common.json", $(if ($script:fileProblems.Count) { "PROBLEMS" } else { "ok" }))
$script:fileProblems | ForEach-Object { Write-Output $_ }
foreach ($p in "de", "ba", "as", "da") {
  $script:fileProblems = @()
  $en = Load "$Root\content\interview\$p.json"; $fr = Load "$Root\content\interview\fr\$p.json"
  Check 1 ((Len $en.role) -eq (Len $fr.role)) "role count"
  for ($i = 0; $i -lt (Len $en.role); $i++) { Check 1 ($en.role[$i].id -ceq $fr.role[$i].id) "role $i id"; Check 1 ($en.role[$i].q -ne $fr.role[$i].q) "role $i not translated" }
  Write-Output ("{0,-22} {1}" -f "interview/$p.json", $(if ($script:fileProblems.Count) { "PROBLEMS" } else { "ok" }))
  $script:fileProblems | ForEach-Object { Write-Output $_ }
}
# No BOM anywhere
Get-ChildItem "$Root\content\courses\fr\*.json", "$Root\content\interview\fr\*.json" | ForEach-Object {
  $b = [System.IO.File]::ReadAllBytes($_.FullName)[0..2]; if ($b[0] -eq 0xEF -and $b[1] -eq 0xBB) { Write-Output "BOM in $($_.Name)"; $problems++ }
}
Write-Output "TOTAL PROBLEMS: $problems"
