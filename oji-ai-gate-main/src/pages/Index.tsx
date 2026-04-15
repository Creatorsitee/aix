import { useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Send, Menu, Sparkles, ChevronDown, User, Bot, Loader2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const MODELS = [
  { group: "OpenRouter (Free)", models: [
    "arcee-ai/trinity-large-preview:free", "stepfun/step-3.5-flash:free",
    "nvidia/nemotron-3-nano-30b-a3b:free", "openrouter/aurora-alpha",
    "upstage/solar-pro-3:free", "arcee-ai/trinity-mini:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
  ]},
  { group: "Groq", models: [
    "groq/compound", "openai/gpt-oss-120b",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "qwen/qwen3-32b", "moonshotai/kimi-k2-instruct-0905",
  ]},
  { group: "GitHub Models", models: [
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
  ]},
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-chat`;

export default function Index() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("openai/gpt-4.1-mini");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef<string>("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsAuthenticated(true);
        navigate("/dashboard");
      } else {
        setIsAuthenticated(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        setIsAuthenticated(true);
        navigate("/dashboard");
      } else {
        setIsAuthenticated(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let assistantContent = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages, model: selectedModel }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let updateCounter = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              // Batch updates every 3 tokens for better performance
              updateCounter++;
              if (updateCounter % 3 === 0 || assistantContent.length > 500) {
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant") {
                    return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                  }
                  return [...prev, { role: "assistant", content: assistantContent }];
                });
              }
            }
          } catch { /* partial JSON */ }
        }
      }
      
      // Final update to ensure all content is rendered
      if (assistantContent) {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
          }
          return [...prev, { role: "assistant", content: assistantContent }];
        });
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      const errMsg = e instanceof Error ? e.message : "Unknown error";
      setMessages(prev => [...prev, { role: "assistant", content: `❌ Error: ${errMsg}` }]);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [input, isLoading, messages, selectedModel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    setIsLoading(false);
  };

  const filteredModels = MODELS.map(g => ({
    ...g,
    models: g.models.filter(m => m.toLowerCase().includes(modelSearch.toLowerCase())),
  })).filter(g => g.models.length > 0);

  const hasMessages = messages.length > 0;

  return (
    <div className="min-h-screen bg-[#0a0a12] text-[#e0e0e8] flex flex-col">
      {/* Header */}
      <header className="relative z-50 border-b border-[#1a1a2e] shrink-0">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-lg hover:bg-[#1a1a2e] transition-colors lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:flex items-center gap-2">
            <img src="/logo-rest-api.jpg" alt="OJI AI" className="h-7 w-7 rounded-lg object-cover" />
            <span className="font-bold text-sm">OJI AI</span>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm" className="border-primary/50 text-primary hover:bg-primary/10 text-xs h-8">Dashboard</Button>
                <Button onClick={() => navigate("/profile")} variant="outline" size="sm" className="border-primary/50 text-primary hover:bg-primary/10 text-xs h-8">Profile</Button>
              </>
            ) : (
              <>
                <Link to="/auth/login">
                  <Button variant="outline" size="sm" className="border-primary/50 text-primary hover:bg-primary/10 text-xs h-8">Login</Button>
                </Link>
                <Link to="/auth/register">
                  <Button variant="outline" size="sm" className="border-primary/50 text-primary hover:bg-primary/10 text-xs h-8">Register</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-[#0a0a12]/95 backdrop-blur-sm lg:hidden flex flex-col items-center justify-center gap-4" onClick={() => setMenuOpen(false)}>
          {isAuthenticated ? (
            <>
              <div className="text-sm text-primary/70 mb-2">Chat History</div>
              <Button onClick={() => navigate("/dashboard")} variant="outline" size="lg" className="border-primary/50 text-primary w-48">Dashboard</Button>
              <Button onClick={() => navigate("/profile")} variant="outline" size="lg" className="border-primary/50 text-primary w-48">Profile</Button>
            </>
          ) : (
            <>
              <Link to="/auth/login"><Button variant="outline" size="lg" className="border-primary/50 text-primary w-48">Login</Button></Link>
              <Link to="/auth/register"><Button variant="outline" size="lg" className="border-primary/50 text-primary w-48">Register</Button></Link>
            </>
          )}
        </div>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {!hasMessages ? (
            /* Empty state - hero */
            <div className="flex flex-col items-center justify-center min-h-full px-4 py-12">
              {/* Orbital */}
              <div className="relative w-44 h-44 sm:w-56 sm:h-56 mb-6">
                <div className="absolute inset-0 rounded-full border border-primary/15 animate-[spin_20s_linear_infinite]" />
                <div className="absolute inset-4 rounded-full border border-primary/20 animate-[spin_15s_linear_infinite_reverse]" />
                <div className="absolute inset-8 rounded-full border border-primary/25 animate-[spin_10s_linear_infinite]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <div className="absolute -inset-8 rounded-full bg-primary/10 blur-3xl" />
                    <div className="absolute -inset-4 rounded-full bg-primary/15 blur-xl" />
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-primary/30 to-primary/5 border border-primary/30 flex items-center justify-center">
                      <Sparkles className="w-7 h-7 sm:w-9 sm:h-9 text-primary" />
                    </div>
                  </div>
                </div>
                <div className="absolute inset-0 animate-[spin_20s_linear_infinite]">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary/60" />
                </div>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
                OJI <span className="text-primary">AI</span>
              </h1>
              <p className="text-[#8888a0] text-sm mb-4">Jelajahi kecerdasan buatan tanpa batas</p>
              <p className="text-[#555570] text-xs max-w-md text-center">
                Gratis tanpa login. 40+ model AI siap digunakan. Untuk membuat platform AI sendiri, daftar dan buat API key di dashboard.
              </p>
            </div>
          ) : (
            /* Chat messages */
            <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center mt-1">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary/20 text-[#e0e0e8]"
                      : "bg-[#16162a] text-[#d0d0e0]"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_pre]:bg-[#0d0d1a] [&_pre]:rounded-lg [&_pre]:p-0 [&_code]:text-primary/80 [&_ul]:my-1 [&_ol]:my-1 [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm">
                        <ReactMarkdown
                          components={{
                            code({ inline, className, children, ...props }) {
                              const match = /language-(\w+)/.exec(className || "");
                              const lang = match ? match[1] : "text";
                              return !inline ? (
                                <SyntaxHighlighter
                                  style={oneDark}
                                  language={lang}
                                  PreTag="div"
                                  className="rounded-lg my-2 text-xs"
                                  customStyle={{ margin: "0.5rem 0", padding: "0.75rem" }}
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, "")}
                                </SyntaxHighlighter>
                              ) : (
                                <code className="bg-[#0d0d1a] px-1.5 py-0.5 rounded text-primary/80 text-xs" {...props}>
                                  {children}
                                </code>
                              );
                            }
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="shrink-0 w-7 h-7 rounded-full bg-[#1a1a2e] flex items-center justify-center mt-1">
                      <User className="w-4 h-4 text-[#8888a0]" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-3 justify-start">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center mt-1">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-[#16162a] rounded-2xl px-4 py-3">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t border-[#1a1a2e] bg-[#0a0a12] px-4 py-3">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl border border-[#1a1a2e] bg-[#12121e] p-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ketik pesan..."
                rows={1}
                className="w-full bg-transparent text-sm text-[#e0e0e8] placeholder-[#555570] outline-none resize-none max-h-32"
                style={{ minHeight: "24px" }}
              />
              <div className="flex items-center justify-between mt-2">
                <div className="relative">
                  <button
                    onClick={() => setShowModelPicker(!showModelPicker)}
                    className="flex items-center gap-1.5 text-[10px] text-primary/70 hover:text-primary border border-primary/20 rounded-lg px-2.5 py-1.5 hover:bg-primary/5 transition-colors"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span className="max-w-[140px] truncate">{selectedModel}</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>

                  {showModelPicker && (
                    <div className="absolute bottom-full left-0 mb-2 w-72 max-h-80 overflow-y-auto rounded-xl border border-[#1a1a2e] bg-[#12121e] shadow-2xl z-50">
                      <div className="sticky top-0 bg-[#12121e] p-2 border-b border-[#1a1a2e]">
                        <input
                          type="text"
                          value={modelSearch}
                          onChange={e => setModelSearch(e.target.value)}
                          placeholder="Cari model..."
                          className="w-full bg-[#0a0a12] text-xs text-[#e0e0e8] placeholder-[#555570] rounded-lg px-3 py-2 outline-none border border-[#1a1a2e] focus:border-primary/30"
                          autoFocus
                        />
                      </div>
                      {filteredModels.map(g => (
                        <div key={g.group}>
                          <div className="px-3 py-1.5 text-[9px] font-semibold text-[#555570] uppercase tracking-wider">{g.group}</div>
                          {g.models.map(m => (
                            <button
                              key={m}
                              onClick={() => { setSelectedModel(m); setShowModelPicker(false); setModelSearch(""); }}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-primary/10 transition-colors ${
                                selectedModel === m ? "text-primary bg-primary/5" : "text-[#b0b0c0]"
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isLoading && (
                    <button onClick={stopGeneration} className="h-8 w-8 rounded-full bg-destructive/20 text-destructive flex items-center justify-center hover:bg-destructive/30 transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading}
                    className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center hover:bg-primary/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
            <p className="text-center text-[10px] text-primary/40 mt-2">
              OJI AI dapat membuat kesalahan. Periksa info penting.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
