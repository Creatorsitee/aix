import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = claimsData.claims.sub as string;
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Check owner or admin
    const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", userId).single();
    if (!roleData || (roleData.role !== "admin" && roleData.role !== "owner")) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin/Owner access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "stats") {
      const { count: totalUsers } = await adminClient.from("profiles").select("*", { count: "exact", head: true });
      const { count: totalKeys } = await adminClient.from("api_keys").select("*", { count: "exact", head: true });
      const { count: totalRequests } = await adminClient.from("usage_logs").select("*", { count: "exact", head: true });
      const { data: tokenData } = await adminClient.from("usage_logs").select("tokens_used");
      const totalTokens = (tokenData || []).reduce((s: number, r: Record<string, unknown>) => s + ((r.tokens_used as number) || 0), 0);
      const { data: coinData } = await adminClient.from("user_coins").select("balance");
      const totalCoins = (coinData || []).reduce((s: number, r: Record<string, unknown>) => s + ((r.balance as number) || 0), 0);
      const { count: blacklistedCount } = await adminClient.from("blacklisted_users").select("*", { count: "exact", head: true });

      return new Response(JSON.stringify({
        total_users: totalUsers || 0, total_keys: totalKeys || 0,
        total_requests: totalRequests || 0, total_tokens: totalTokens, total_coins: totalCoins,
        blacklisted_users: blacklistedCount || 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "users") {
      const { data: profiles } = await adminClient.from("profiles").select("*").order("created_at", { ascending: false });
      const { data: keys } = await adminClient.from("api_keys").select("user_id, id, is_active");
      const { data: roles } = await adminClient.from("user_roles").select("user_id, role");
      const { data: coins } = await adminClient.from("user_coins").select("user_id, balance");
      const { data: blacklist } = await adminClient.from("blacklisted_users").select("user_id");
      const blSet = new Set((blacklist || []).map((b: Record<string, unknown>) => b.user_id));

      const users = (profiles || []).map((p: Record<string, unknown>) => ({
        ...p,
        api_keys_count: (keys || []).filter((k: Record<string, unknown>) => k.user_id === p.id).length,
        active_keys: (keys || []).filter((k: Record<string, unknown>) => k.user_id === p.id && k.is_active).length,
        roles: (roles || []).filter((r: Record<string, unknown>) => r.user_id === p.id).map((r: Record<string, unknown>) => r.role),
        coins: (coins || []).find((c: Record<string, unknown>) => c.user_id === p.id)?.balance ?? 0,
        is_blacklisted: blSet.has(p.id),
      }));

      return new Response(JSON.stringify(users), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "usage") {
      const { data: usage } = await adminClient.from("usage_logs").select("*").order("created_at", { ascending: false }).limit(500);
      return new Response(JSON.stringify(usage || []), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "recent_logs") {
      const { data: logs } = await adminClient.from("usage_logs")
        .select("id, model, provider, status_code, method, locale, created_at")
        .order("created_at", { ascending: false }).limit(20);
      return new Response(JSON.stringify(logs || []), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "provider_settings") {
      const { data } = await adminClient.from("provider_settings").select("*").order("provider");
      const envProviders = [
        { provider: "openrouter", hasEnv: !!Deno.env.get("OPENROUTER_API_KEY") },
        { provider: "groq", hasEnv: !!Deno.env.get("GROQ_API_KEY") },
        { provider: "github", hasEnv: !!Deno.env.get("GITHUB_TOKEN") },
      ];
      return new Response(JSON.stringify({ settings: data || [], env_status: envProviders }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update_provider" && req.method === "POST") {
      const body = await req.json();
      const { provider, api_key } = body;
      if (!provider || !api_key) {
        return new Response(JSON.stringify({ error: "provider and api_key are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data, error } = await adminClient.from("provider_settings")
        .upsert({ provider, api_key, is_active: true, updated_at: new Date().toISOString() }, { onConflict: "provider" })
        .select().single();
      if (error) return new Response(JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete_provider" && req.method === "POST") {
      const body = await req.json();
      await adminClient.from("provider_settings").delete().eq("provider", body.provider);
      return new Response(JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- BLACKLIST ---
    if (action === "blacklist_user" && req.method === "POST") {
      const body = await req.json();
      if (!body.user_id) return new Response(JSON.stringify({ error: "user_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      await adminClient.from("blacklisted_users").insert({
        user_id: body.user_id, reason: body.reason || "", blocked_by: userId,
      });
      return new Response(JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "unblacklist_user" && req.method === "POST") {
      const body = await req.json();
      await adminClient.from("blacklisted_users").delete().eq("user_id", body.user_id);
      return new Response(JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- MAINTENANCE ---
    if (action === "set_maintenance" && req.method === "POST") {
      // Only owner can toggle maintenance
      if (roleData.role !== "owner") {
        return new Response(JSON.stringify({ error: "Only owner can manage maintenance mode" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const body = await req.json();
      await adminClient.from("app_settings")
        .upsert({ key: "maintenance_mode", value: { enabled: !!body.enabled }, updated_at: new Date().toISOString() }, { onConflict: "key" });
      return new Response(JSON.stringify({ success: true, maintenance: !!body.enabled }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "get_maintenance") {
      const { data } = await adminClient.from("app_settings").select("value").eq("key", "maintenance_mode").single();
      return new Response(JSON.stringify(data?.value || { enabled: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- SET ROLE (owner only) ---
    if (action === "set_role" && req.method === "POST") {
      if (roleData.role !== "owner") {
        return new Response(JSON.stringify({ error: "Only owner can change roles" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const body = await req.json();
      if (!body.user_id || !body.role) return new Response(JSON.stringify({ error: "user_id and role required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      
      await adminClient.from("user_roles").update({ role: body.role }).eq("user_id", body.user_id);
      return new Response(JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: "Internal server error", message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
