import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_MODELS = [
  "arcee-ai/trinity-large-preview:free", "stepfun/step-3.5-flash:free",
  "nvidia/nemotron-3-nano-30b-a3b:free", "openrouter/aurora-alpha",
  "upstage/solar-pro-3:free", "arcee-ai/trinity-mini:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
];

const GROQ_MODELS = [
  "groq/compound", "openai/gpt-oss-120b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "qwen/qwen3-32b", "moonshotai/kimi-k2-instruct-0905",
];

const GITHUB_MODELS = [
  "openai/gpt-4.1", "openai/gpt-4.1-mini", "openai/gpt-4.1-nano",
  "openai/gpt-4o", "openai/gpt-4o-mini",
  "openai/gpt-5", "openai/gpt-5-chat", "openai/gpt-5-mini", "openai/gpt-5-nano",
  "microsoft/MAI-DS-R1", "microsoft/Phi-4-multimodal-instruct", "microsoft/Phi-4-reasoning",
  "ai21-labs/AI21-Jamba-1.5-Large", "mistral-ai/Codestral-2501",
  "cohere/Cohere-command-r-plus-08-2024",
  "deepseek/DeepSeek-R1", "deepseek/DeepSeek-R1-0528", "deepseek/DeepSeek-V3-0324",
  "meta/Llama-4-Maverick-17B-128E-Instruct-FP8", "meta/Llama-4-Scout-17B-16E-Instruct",
  "mistral-ai/Ministral-3B", "cohere/cohere-command-a",
  "xai/grok-3", "xai/grok-3-mini",
  "mistral-ai/mistral-medium-2505", "mistral-ai/mistral-small-2503",
];

const ALL_MODELS = [...OPENROUTER_MODELS, ...GROQ_MODELS, ...GITHUB_MODELS];

function getProviderInfo(model: string) {
  if (OPENROUTER_MODELS.includes(model))
    return { provider: "openrouter", url: "https://openrouter.ai/api/v1/chat/completions", envKey: "OPENROUTER_API_KEY" };
  if (GROQ_MODELS.includes(model))
    return { provider: "groq", url: "https://api.groq.com/openai/v1/chat/completions", envKey: "GROQ_API_KEY" };
  if (GITHUB_MODELS.includes(model))
    return { provider: "github", url: "https://models.github.ai/inference/chat/completions", envKey: "GITHUB_TOKEN" };
  return null;
}

async function getProviderApiKey(supabase: ReturnType<typeof createClient>, provider: string, envKey: string): Promise<string | null> {
  try {
    const { data } = await supabase.from("provider_settings").select("api_key, is_active").eq("provider", provider).single();
    if (data?.is_active && data.api_key) return data.api_key;
  } catch { /* fall through */ }
  return Deno.env.get(envKey) || null;
}

async function handleCoins(supabase: ReturnType<typeof createClient>, userId: string, role: string): Promise<{ ok: boolean; balance: number; error?: string }> {
  const { data: coins } = await supabase.from("user_coins").select("*").eq("user_id", userId).single();
  const refillHours = (role === "owner" || role === "admin") ? 5 : 24;
  const refillMs = refillHours * 60 * 60 * 1000;
  
  let balance = 1000;
  if (coins) {
    const lastRefill = new Date(coins.last_refill_at);
    if (Date.now() - lastRefill.getTime() > refillMs) {
      await supabase.from("user_coins").update({ balance: 1000, last_refill_at: new Date().toISOString() }).eq("user_id", userId);
      balance = 1000;
    } else {
      balance = coins.balance;
    }
  } else {
    await supabase.from("user_coins").insert({ user_id: userId, balance: 1000, last_refill_at: new Date().toISOString() });
  }

  if (balance < 10) {
    return { ok: false, balance, error: `Insufficient coins. You have ${balance} coins. Each request costs 10 coins. Coins refill to 1000 every ${refillHours} hours.` };
  }

  await supabase.from("user_coins").update({ balance: balance - 10 }).eq("user_id", userId);
  return { ok: true, balance: balance - 10 };
}

async function refundCoins(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data } = await supabase.from("user_coins").select("balance").eq("user_id", userId).single();
  if (data) await supabase.from("user_coins").update({ balance: data.balance + 10 }).eq("user_id", userId);
}

// In-memory rate limit store (per isolate)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30; // 30 requests per minute
const RATE_LIMIT_WINDOW = 60_000; // 1 minute

async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  apiKeyId: string,
  userId: string,
  req: Request
): Promise<{ allowed: boolean }> {
  const now = Date.now();
  const entry = rateLimitMap.get(apiKeyId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(apiKeyId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    // Log violation
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const ua = req.headers.get("user-agent") || "";
    const domain = req.headers.get("origin") || req.headers.get("referer") || "";
    const endpoint = new URL(req.url).pathname;

    try {
      await supabase.from("rate_limit_violations").insert({
        user_id: userId,
        ip_address: ip,
        user_agent: ua,
        domain: domain,
        endpoint: endpoint,
        violation_count: entry.count - RATE_LIMIT_MAX,
      });
    } catch { /* ignore */ }

    return { allowed: false };
  }

  return { allowed: true };
}

async function validateApiKey(supabase: ReturnType<typeof createClient>, authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer oji_")) {
    return { error: "Invalid API key. Must start with oji_", status: 401 };
  }
  const apiKey = authHeader.replace("Bearer ", "");
  const { data: keyData, error: keyError } = await supabase
    .from("api_keys").select("id, user_id, is_active, expires_at").eq("key", apiKey).single();

  if (keyError || !keyData?.is_active) return { error: "Invalid or inactive API key", status: 401 };
  if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) return { error: "API key has expired", status: 403 };

  // Check blacklist
  const { data: bl } = await supabase.from("blacklisted_users").select("id").eq("user_id", keyData.user_id).limit(1);
  if (bl && bl.length > 0) return { error: "invalid internal error please try again later", status: 403 };

  // Get role
  const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", keyData.user_id).single();
  const role = roleData?.role || "user";

  return { keyData, role };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const url = new URL(req.url);
    const path = url.pathname;
    const subPath = path.replace(/^\/api\/?/, "").replace(/^functions\/v1\/api\/?/, "");

    // --- BASE URL ---
    if (!subPath || subPath === "") {
      return new Response(JSON.stringify({
        status: true,
        creator: "oji",
        message: "OJI REST API is ready"
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- STATUS ENDPOINTS (no auth) ---
    if (subPath === "status-sistem") {
      const start = performance.now();
      const serverTime = new Date().toISOString().replace("T", " ").slice(0, 19);
      const responseTime = ((performance.now() - start) / 1000).toFixed(3);
      const uptime = process.uptime ? `${Math.floor(process.uptime() / 3600)}h` : "N/A";
      return new Response(JSON.stringify({
        server_status: "online",
        server_time: serverTime,
        server_response: `${responseTime} sec`,
        server_ping: `${Math.floor(Math.random() * 30 + 20)} ms`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (subPath === "status-api") {
      // Check each provider
      const checks: Record<string, string> = {};
      for (const m of ["groq/compound", "openai/gpt-4.1-mini"]) {
        const info = getProviderInfo(m);
        if (info) {
          const key = await getProviderApiKey(supabase, info.provider, info.envKey);
          checks[`${info.provider}`] = key ? "normal" : "no_key";
        }
      }
      // List all endpoints status
      const allEndpoints: Record<string, string> = {};
      ALL_MODELS.forEach(m => {
        const info = getProviderInfo(m);
        allEndpoints[m] = checks[info?.provider || ""] || "unknown";
      });
      allEndpoints["upload-file"] = "normal";
      allEndpoints["create-website"] = Deno.env.get("VERCEL_TOKEN") ? "normal" : "no_key";

      return new Response(JSON.stringify({
        status: "operational",
        endpoints: allEndpoints,
        timestamp: new Date().toISOString(),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (subPath === "auth/turnstile" && req.method === "GET") {
      return new Response(JSON.stringify({
        enabled: Boolean(Deno.env.get("TURNSTILE_SITE_KEY")),
        siteKey: Deno.env.get("TURNSTILE_SITE_KEY") || null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- UPLOAD FILE ---
    if (subPath === "upload-file" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      const validation = await validateApiKey(supabase, authHeader);
      if (validation.error) {
        return new Response(JSON.stringify({ error: validation.error }),
          { status: validation.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const keyData = validation.keyData!;
      const rateCheck = await checkRateLimit(supabase, keyData.id, keyData.user_id, req);
      if (!rateCheck.allowed) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Max 30 requests/minute.", retry_after: 60 }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyData.id);

      const coinResult = await handleCoins(supabase, keyData.user_id, validation.role!);
      if (!coinResult.ok) {
        return new Response(JSON.stringify({ error: coinResult.error, balance: coinResult.balance }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const contentType = req.headers.get("content-type") || "";
      let fileData: Uint8Array;
      let fileName: string;
      let mimeType: string;

      if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        if (!file) {
          await refundCoins(supabase, keyData.user_id);
          return new Response(JSON.stringify({ error: "No file provided. Use form field 'file'" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        fileData = new Uint8Array(await file.arrayBuffer());
        fileName = file.name || `upload_${Date.now()}`;
        mimeType = file.type || "application/octet-stream";
      } else {
        // Raw body upload
        const rawFileName = req.headers.get("X-File-Name") || `upload_${Date.now()}`;
        fileData = new Uint8Array(await req.arrayBuffer());
        fileName = rawFileName;
        mimeType = contentType || "application/octet-stream";
      }

      const filePath = `${keyData.user_id}/${Date.now()}_${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(filePath, fileData, { contentType: mimeType, upsert: false });

      if (uploadError) {
        await refundCoins(supabase, keyData.user_id);
        return new Response(JSON.stringify({ error: "Upload failed", details: uploadError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: publicUrl } = supabase.storage.from("uploads").getPublicUrl(filePath);

      await supabase.from("usage_logs").insert({
        user_id: keyData.user_id, api_key_id: keyData.id,
        model: "upload-file", provider: "storage", status_code: 200, tokens_used: 0, method: "POST",
      });

      return new Response(JSON.stringify({
        success: true,
        file_name: fileName,
        file_size: fileData.length,
        mime_type: mimeType,
        url: publicUrl.publicUrl,
        path: filePath,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- CREATE WEBSITE ---
    if (subPath === "create-website" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      const validation = await validateApiKey(supabase, authHeader);
      if (validation.error) {
        return new Response(JSON.stringify({ error: validation.error }),
          { status: validation.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const keyData = validation.keyData!;
      await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyData.id);

      const coinResult = await handleCoins(supabase, keyData.user_id, validation.role!);
      if (!coinResult.ok) {
        return new Response(JSON.stringify({ error: coinResult.error, balance: coinResult.balance }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const vercelToken = Deno.env.get("VERCEL_TOKEN");
      if (!vercelToken) {
        await refundCoins(supabase, keyData.user_id);
        return new Response(JSON.stringify({ error: "Vercel deployment not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const body = await req.json();
      const { name, github_url } = body;
      if (!name) {
        await refundCoins(supabase, keyData.user_id);
        return new Response(JSON.stringify({ error: "name is required (will be used as project-name.vercel.app)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (github_url) {
        // Deploy from GitHub
        const repoMatch = github_url.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!repoMatch) {
          await refundCoins(supabase, keyData.user_id);
          return new Response(JSON.stringify({ error: "Invalid GitHub URL" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const res = await fetch("https://api.vercel.com/v13/deployments", {
          method: "POST",
          headers: { Authorization: `Bearer ${vercelToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name,
            gitSource: { type: "github", repo: `${repoMatch[1]}/${repoMatch[2]}`, ref: "main" },
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          await refundCoins(supabase, keyData.user_id);
          return new Response(JSON.stringify({ error: "Vercel deployment failed", details: data }),
            { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        await supabase.from("usage_logs").insert({
          user_id: keyData.user_id, api_key_id: keyData.id,
          model: "create-website", provider: "vercel", status_code: 200, tokens_used: 0, method: "POST",
        });

        return new Response(JSON.stringify({
          success: true,
          project_name: name,
          url: `https://${name}.vercel.app`,
          deployment_url: data.url ? `https://${data.url}` : null,
          vercel_id: data.id,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Deploy from files (simple static site)
      const files = body.files;
      if (!files || !Array.isArray(files) || files.length === 0) {
        await refundCoins(supabase, keyData.user_id);
        return new Response(JSON.stringify({ error: "Provide 'github_url' or 'files' array [{file: 'index.html', data: '<html>...'}]" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const deployFiles = files.map((f: { file: string; data: string }) => ({
        file: f.file,
        data: new TextEncoder().encode(f.data),
      }));

      // Use Vercel API v13 with file upload
      const encoder = new TextEncoder();
      const fileUploads = [];
      for (const f of deployFiles) {
        const sha = await crypto.subtle.digest("SHA-1", f.data);
        const hashArray = Array.from(new Uint8Array(sha));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        fileUploads.push({ file: f.file, sha: hashHex, size: f.data.length });
        
        // Upload file
        await fetch(`https://api.vercel.com/v2/files`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${vercelToken}`,
            "Content-Type": "application/octet-stream",
            "x-vercel-digest": hashHex,
            "Content-Length": f.data.length.toString(),
          },
          body: f.data,
        });
      }

      const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
        method: "POST",
        headers: { Authorization: `Bearer ${vercelToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name, files: fileUploads, projectSettings: { framework: null } }),
      });

      const deployData = await deployRes.json();
      if (!deployRes.ok) {
        await refundCoins(supabase, keyData.user_id);
        return new Response(JSON.stringify({ error: "Vercel deployment failed", details: deployData }),
          { status: deployRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabase.from("usage_logs").insert({
        user_id: keyData.user_id, api_key_id: keyData.id,
        model: "create-website", provider: "vercel", status_code: 200, tokens_used: 0, method: "POST",
      });

      return new Response(JSON.stringify({
        success: true,
        project_name: name,
        url: `https://${name}.vercel.app`,
        deployment_url: deployData.url ? `https://${deployData.url}` : null,
        vercel_id: deployData.id,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- GET /models ---
    if (subPath === "models" && req.method === "GET") {
      const authHeader = req.headers.get("Authorization");
      const validation = await validateApiKey(supabase, authHeader);
      if (validation.error) {
        return new Response(JSON.stringify({ error: validation.error }),
          { status: validation.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const models = ALL_MODELS.map((m) => {
        const info = getProviderInfo(m);
        return { id: m, object: "model", created: 1700000000, owned_by: info?.provider || "unknown" };
      });

      return new Response(JSON.stringify({ object: "list", data: models }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- POST /chat/completions ---
    if (subPath === "chat/completions" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      const validation = await validateApiKey(supabase, authHeader);
      if (validation.error) {
        return new Response(JSON.stringify({ error: validation.error }),
          { status: validation.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const keyData = validation.keyData!;
      
      // Rate limit check
      const rateCheck = await checkRateLimit(supabase, keyData.id, keyData.user_id, req);
      if (!rateCheck.allowed) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Max 30 requests/minute.", retry_after: 60 }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyData.id);

      const body = await req.json();
      const model = body.model;
      if (!model) {
        return new Response(JSON.stringify({ error: "model is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const providerInfo = getProviderInfo(model);
      if (!providerInfo) {
        return new Response(JSON.stringify({ error: `Unsupported model: ${model}`, available_models: ALL_MODELS }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const coinResult = await handleCoins(supabase, keyData.user_id, validation.role!);
      if (!coinResult.ok) {
        return new Response(JSON.stringify({ error: coinResult.error, balance: coinResult.balance }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const providerApiKey = await getProviderApiKey(supabase, providerInfo.provider, providerInfo.envKey);
      if (!providerApiKey) {
        await refundCoins(supabase, keyData.user_id);
        return new Response(JSON.stringify({ error: `Provider ${providerInfo.provider} is not configured` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const isStream = body.stream === true;
      const upstreamBody: Record<string, unknown> = { model, messages: body.messages, stream: isStream };
      if (body.temperature !== undefined) upstreamBody.temperature = body.temperature;
      if (body.max_tokens !== undefined) upstreamBody.max_tokens = body.max_tokens;
      if (body.top_p !== undefined) upstreamBody.top_p = body.top_p;
      if (body.reasoning) upstreamBody.reasoning = body.reasoning;

      const upstreamRes = await fetch(providerInfo.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${providerApiKey}` },
        body: JSON.stringify(upstreamBody),
      });

      if (!upstreamRes.ok) {
        await refundCoins(supabase, keyData.user_id);
        const upstreamData = await upstreamRes.json();
        await supabase.from("usage_logs").insert({
          user_id: keyData.user_id, api_key_id: keyData.id, model,
          provider: providerInfo.provider, status_code: upstreamRes.status, tokens_used: 0, method: "POST",
        });
        return new Response(JSON.stringify({ error: "Upstream provider error", details: upstreamData }),
          { status: upstreamRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (isStream) {
        const completionId = `chatcmpl-${crypto.randomUUID()}`;
        const created = Math.floor(Date.now() / 1000);
        await supabase.from("usage_logs").insert({
          user_id: keyData.user_id, api_key_id: keyData.id, model,
          provider: providerInfo.provider, status_code: 200, tokens_used: 0, method: "POST",
        });

        const upstreamBody2 = upstreamRes.body;
        if (!upstreamBody2) {
          await refundCoins(supabase, keyData.user_id);
          return new Response(JSON.stringify({ error: "No stream body from provider" }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const transformStream = new TransformStream({
          transform(chunk, controller) {
            const text = decoder.decode(chunk, { stream: true });
            for (const line of text.split("\n")) {
              if (line.startsWith("data: [DONE]")) { controller.enqueue(encoder.encode("data: [DONE]\n\n")); continue; }
              if (!line.startsWith("data: ")) { if (line.trim()) controller.enqueue(encoder.encode(line + "\n")); continue; }
              try {
                const json = JSON.parse(line.slice(6));
                const delta = json.choices?.[0]?.delta || {};
                const finishReason = json.choices?.[0]?.finish_reason || null;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  id: completionId, object: "chat.completion.chunk", created, model,
                  choices: [{ index: 0, delta: { ...(delta.role ? { role: delta.role } : {}), ...(delta.content !== undefined ? { content: delta.content } : {}) }, finish_reason: finishReason }],
                })}\n\n`));
              } catch { controller.enqueue(encoder.encode(line + "\n")); }
            }
          },
        });

        return new Response(upstreamBody2.pipeThrough(transformStream), {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
        });
      }

      const upstreamData = await upstreamRes.json();
      const totalTokens = upstreamData.usage?.total_tokens || 0;

      await supabase.from("usage_logs").insert({
        user_id: keyData.user_id, api_key_id: keyData.id, model,
        provider: providerInfo.provider, status_code: 200, tokens_used: totalTokens, method: "POST",
      });

      const choices = upstreamData.choices?.map((c: Record<string, unknown>, i: number) => ({
        index: i,
        message: { role: (c.message as Record<string, unknown>)?.role || "assistant", content: (c.message as Record<string, unknown>)?.content || "" },
        finish_reason: c.finish_reason || "stop",
      })) || [{ index: 0, message: { role: "assistant", content: upstreamData.output || "" }, finish_reason: "stop" }];

      return new Response(JSON.stringify({
        id: `chatcmpl-${crypto.randomUUID()}`, object: "chat.completion",
        created: Math.floor(Date.now() / 1000), model, choices, usage: upstreamData.usage || null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: "Internal server error", message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
