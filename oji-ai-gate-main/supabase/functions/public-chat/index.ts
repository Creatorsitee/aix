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

// Simple in-memory rate limit per IP
const ipRateMap = new Map<string, { count: number; resetAt: number }>();

function checkIpRate(ip: string): boolean {
  const now = Date.now();
  const entry = ipRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRateMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count++;
  return entry.count <= 10; // 10 req/min for free public chat
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    if (!checkIpRate(ip)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Max 10 requests/minute for free chat." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { messages, model: requestedModel } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const model = requestedModel || "openai/gpt-4.1-mini";
    const providerInfo = getProviderInfo(model);
    if (!providerInfo) {
      return new Response(JSON.stringify({ error: `Unsupported model: ${model}`, available_models: ALL_MODELS }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get API key from env
    const apiKey = Deno.env.get(providerInfo.envKey);
    if (!apiKey) {
      // Try from DB
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data } = await supabase.from("provider_settings").select("api_key, is_active").eq("provider", providerInfo.provider).single();
      if (!data?.is_active || !data.api_key) {
        return new Response(JSON.stringify({ error: `Provider ${providerInfo.provider} not available` }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      return await doStream(providerInfo.url, data.api_key, model, messages);
    }

    return await doStream(providerInfo.url, apiKey, model, messages);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: "Internal server error", message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

async function doStream(url: string, apiKey: string, model: string, messages: Array<{ role: string; content: string }>) {
  const upstreamRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Kamu adalah OJI AI, asisten AI yang membantu. Jawab dengan jelas dan ringkas." },
        ...messages,
      ],
      stream: true,
    }),
  });

  if (!upstreamRes.ok) {
    const errData = await upstreamRes.text();
    return new Response(JSON.stringify({ error: "AI provider error", details: errData }),
      { status: upstreamRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (!upstreamRes.body) {
    return new Response(JSON.stringify({ error: "No response body" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const completionId = `chatcmpl-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const transformStream = new TransformStream({
    transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true });
      for (const line of text.split("\n")) {
        if (line.startsWith("data: [DONE]")) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          continue;
        }
        if (!line.startsWith("data: ")) {
          if (line.trim()) controller.enqueue(encoder.encode(line + "\n"));
          continue;
        }
        try {
          const json = JSON.parse(line.slice(6));
          const delta = json.choices?.[0]?.delta || {};
          const finishReason = json.choices?.[0]?.finish_reason || null;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            id: completionId, object: "chat.completion.chunk", created, model,
            choices: [{
              index: 0,
              delta: {
                ...(delta.role ? { role: delta.role } : {}),
                ...(delta.content !== undefined ? { content: delta.content } : {}),
              },
              finish_reason: finishReason,
            }],
          })}\n\n`));
        } catch {
          controller.enqueue(encoder.encode(line + "\n"));
        }
      }
    },
  });

  return new Response(upstreamRes.body.pipeThrough(transformStream), {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
