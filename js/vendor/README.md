Third-party code served from this site (no CDN, so no visitor data goes to a third party):
- pdf-lib.esm.min.js: pdf-lib 1.17.1 (MIT, https://github.com/Hopding/pdf-lib, pdf-lib.LICENSE.md), the npm package's
  dist/pdf-lib.esm.min.js without its source map comment. Loaded on demand by js/cvpdf.js to build CV PDFs.
- supabase-js.esm.js: @supabase/supabase-js 2.45.4 (MIT, supabase-js.LICENSE), bundled into one ES module with
  `esbuild entry.mjs --bundle --format=esm --platform=browser --minify` where entry.mjs is
  `export { createClient } from "@supabase/supabase-js";`. Imported by js/supabase.js. To upgrade, rebuild it the same way.
Fonts are in fonts/ (Inter and Source Serif 4 from @fontsource, SIL Open Font License).
