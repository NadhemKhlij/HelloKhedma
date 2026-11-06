Third-party code served from this site (no CDN, so no visitor data goes to a third party):
- pdf-lib.esm.min.js: pdf-lib 1.17.1 (MIT, https://github.com/Hopding/pdf-lib, pdf-lib.LICENSE.md), the npm package's
  dist/pdf-lib.esm.min.js without its source map comment. Loaded on demand by js/cvpdf.js to build CV PDFs.
- supabase-js.esm.js: @supabase/supabase-js 2.45.4 (MIT, supabase-js.LICENSE), bundled into one ES module with
  `esbuild entry.mjs --bundle --format=esm --platform=browser --minify` where entry.mjs is
  `export { createClient } from "@supabase/supabase-js";`. Imported by js/supabase.js. To upgrade, rebuild it the same way.
- worker.sql-wasm.js + sql-wasm.wasm: sql.js 1.10.3 (MIT, sql.js.LICENSE), SQLite compiled to WebAssembly, copied as is
  from the npm package's dist/. js/sqlrun.js runs it as a Web Worker (a 5 s limit stops runaway queries).
  CI uses the same version from npm (devDependency sql.js) in scripts/check-content.mjs.
- js-yaml.esm.min.js: js-yaml 4.1.0 (MIT, https://github.com/nodeca/js-yaml, js-yaml.LICENSE), YAML 1.2 parser, bundled
  into one minified ES module with `esbuild entry.mjs --bundle --format=esm --platform=browser --minify
  --legal-comments=inline` where entry.mjs is `export { load, loadAll, YAMLException } from "js-yaml";` (package
  dist/js-yaml.mjs). Imported by js/filecheck.js ("fix this file" exercises), loaded on demand; CI imports the same file.
Fonts are in fonts/ (Inter and Source Serif 4 from @fontsource, SIL Open Font License).
