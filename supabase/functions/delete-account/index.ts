// Supabase Edge Function: delete-account
// Permanently deletes the signed-in user (GDPR right to erasure). profiles, applications and step_progress
// reference auth.users with ON DELETE CASCADE, so their rows go with the user.
// Needs only the secrets Supabase provides automatically (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
//
// Request: POST with the user's session token in Authorization (supabase-js functions.invoke does this).
// Response: { deleted: true } or { error }.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  // Only a real user session can delete itself; the anon key resolves to no user.
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const { data, error } = token ? await admin.auth.getUser(token) : { data: { user: null }, error: null };
  if (error || !data?.user) return json({ error: "You must be signed in to delete your account." }, 401);

  const id = data.user.id;
  const { error: delErr } = await admin.auth.admin.deleteUser(id);
  if (delErr) return json({ error: delErr.message }, 500);

  await admin.from("job_search_hits").delete().eq("bucket", `user:${id}`);
  return json({ deleted: true });
});
