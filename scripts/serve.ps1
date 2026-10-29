# Minimal static file server for local preview on Windows without Node or Python.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/serve.ps1 -Root . -Port 5173
# Then open http://localhost:5173/ (or /preview-test.html, see scripts/preview-cdn.sh). Ctrl+C to stop.
# Used by .claude/launch.json ("hellokhedma") for Claude's browser preview. Localhost only.
param([string]$Root = ".", [int]$Port = 5173)
$Root = (Resolve-Path $Root).Path
$types = @{ ".html"="text/html; charset=utf-8"; ".js"="text/javascript; charset=utf-8"; ".mjs"="text/javascript; charset=utf-8";
  ".css"="text/css; charset=utf-8"; ".json"="application/json"; ".svg"="image/svg+xml"; ".png"="image/png"; ".ico"="image/x-icon" }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Host "Serving $Root on http://localhost:$Port/"
while ($l.IsListening) {
  $ctx = $l.GetContext()
  $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
  if ($rel -eq "") { $rel = "index.html" }
  $file = [IO.Path]::GetFullPath((Join-Path $Root $rel))
  if ($file.StartsWith($Root) -and (Test-Path $file -PathType Leaf)) {
    $bytes = [IO.File]::ReadAllBytes($file)
    $ext = [IO.Path]::GetExtension($file).ToLower()
    $ctx.Response.ContentType = $(if ($types[$ext]) { $types[$ext] } else { "application/octet-stream" })
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else { $ctx.Response.StatusCode = 404 }
  $ctx.Response.Close()
}
