#!/usr/bin/env sh
# Builds preview-test.html: index.html with the Tailwind Play CDN + css/input.css inlined, so the app can be
# previewed with current styles on a machine without Node (no `npm run build`). For local testing only:
# preview-test.html is gitignored and must never be deployed (the CDN is not meant for production).
# Usage (Git Bash, from the repo root): sh scripts/preview-cdn.sh && serve with scripts/serve.ps1, open /preview-test.html
# Needs a local js/config.js (copy js/config.example.js or the public config of the live site).
set -e
css=$(grep -v '^@tailwind' css/input.css)
awk -v css="$css" '/<link rel="stylesheet" href="css\/app.css">/ {
  print "<script src=\"https://cdn.tailwindcss.com/3.4.17\"></script>"
  print "<style type=\"text/tailwindcss\">"
  print "@tailwind base; @tailwind components; @tailwind utilities;"
  print css
  print "</style>"
  next } { print }' index.html > preview-test.html
echo "preview-test.html written"
