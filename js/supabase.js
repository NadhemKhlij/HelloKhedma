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
