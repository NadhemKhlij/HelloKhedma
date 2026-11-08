// Supabase client and runtime config. CONFIG comes from js/config.js: generated at build time by
// scripts/write-config.mjs from GitHub Actions variables, or copied by hand from config.example.js for local work.
// Only the public anon key belongs here; RLS protects the data. `configured` is false until the config is filled,
// and the app then shows a setup banner instead of loading. EMAIL_LINK: what the e-mail link in the address was.
// supabase-js 2.45.4 is self-hosted (js/vendor/supabase-js.esm.js, one ESM file built with esbuild): no third-party CDN
// receives the visitor's IP on every visit (it used to come from esm.sh).
import { createClient } from "./vendor/supabase-js.esm.js";

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
// Read before createClient, which consumes the e-mail link in the address: a password-reset link ("type=recovery")
// and a failed link (expired or already used: "error_description"). auth.js acts on them once the app has started
// (its listener is registered too late to see Supabase's PASSWORD_RECOVERY event).
const linkHash = new URLSearchParams(location.hash.replace(/^#/, ""));
export const EMAIL_LINK = { recovery: linkHash.get("type") === "recovery", error: linkHash.get("error_description") || "" };
export const sb = configured ? createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY) : null;
