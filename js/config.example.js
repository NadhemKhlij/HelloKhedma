// Copy to js/config.js and fill in. The anon key is public by design (RLS protects data).
// NEVER put the service_role key, RapidAPI key or Adzuna keys here.
// Optional keys (set as GitHub Actions variables in production): CONTACT_EMAIL (legal pages), SENTRY_DSN (error monitoring).
export const CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-KEY",
  DEFAULT_COUNTRY: "fr",
};
