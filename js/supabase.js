// Supabase client and runtime config. CONFIG comes from js/config.js: generated at build time by
// scripts/write-config.mjs from GitHub Actions variables, or copied by hand from config.example.js for local work.
// Only the public anon key belongs here; RLS protects the data. `configured` is false until the config is filled,
// and the app then shows a setup banner instead of loading.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

let CONFIG = {};
try {
  ({ CONFIG } = await import("./config.js"));
} catch {
  /* config.js missing: the app shows a setup banner */
}

export { CONFIG };
export const configured = Boolean(
  CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && !CONFIG.SUPABASE_URL.includes("YOUR-PROJECT"),
);
export const sb = configured ? createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY) : null;
