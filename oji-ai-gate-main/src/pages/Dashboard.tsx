import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import UsernameDialog from "@/components/UsernameDialog";
import {
  Key, BookOpen, Play, Cpu, LogOut, User, ShieldCheck, Coins,
  Copy, Check, Eye, EyeOff, Trash2, Send, ChevronDown, ChevronRight,
  Globe, Upload, Server, Activity, Code2, Terminal, Search,
  Zap, Clock, BarChart3, ArrowRight, FileUp, Shield,
} from "lucide-react";

interface ApiKey {
  id: string; key: string; name: string; is_active: boolean;
  created_at: string; last_used_at: string | null; expires_at: string | null;
}

const AI_MODELS = [
  { name: "openai/gpt-5", provider: "GitHub" },
  { name: "openai/gpt-5-chat", provider: "GitHub" },
  { name: "openai/gpt-5-mini", provider: "GitHub" },
  { name: "openai/gpt-5-nano", provider: "GitHub" },
  { name: "openai/gpt-4.1", provider: "GitHub" },
  { name: "openai/gpt-4.1-mini", provider: "GitHub" },
  { name: "openai/gpt-4.1-nano", provider: "GitHub" },
  { name: "openai/gpt-4o", provider: "GitHub" },
  { name: "openai/gpt-4o-mini", provider: "GitHub" },
  { name: "microsoft/MAI-DS-R1", provider: "GitHub" },
  { name: "microsoft/Phi-4-multimodal-instruct", provider: "GitHub" },
  { name: "microsoft/Phi-4-reasoning", provider: "GitHub" },
  { name: "deepseek/DeepSeek-R1", provider: "GitHub" },
  { name: "deepseek/DeepSeek-R1-0528", provider: "GitHub" },
  { name: "deepseek/DeepSeek-V3-0324", provider: "GitHub" },
  { name: "meta/Llama-4-Maverick-17B-128E-Instruct-FP8", provider: "GitHub" },
  { name: "meta/Llama-4-Scout-17B-16E-Instruct", provider: "GitHub" },
  { name: "xai/grok-3", provider: "GitHub" },
  { name: "xai/grok-3-mini", provider: "GitHub" },
  { name: "ai21-labs/AI21-Jamba-1.5-Large", provider: "GitHub" },
  { name: "mistral-ai/Codestral-2501", provider: "GitHub" },
  { name: "mistral-ai/Ministral-3B", provider: "GitHub" },
  { name: "mistral-ai/mistral-medium-2505", provider: "GitHub" },
  { name: "mistral-ai/mistral-small-2503", provider: "GitHub" },
  { name: "cohere/Cohere-command-r-plus-08-2024", provider: "GitHub" },
  { name: "cohere/cohere-command-a", provider: "GitHub" },
  { name: "arcee-ai/trinity-large-preview:free", provider: "OpenRouter" },
  { name: "stepfun/step-3.5-flash:free", provider: "OpenRouter" },
  { name: "nvidia/nemotron-3-nano-30b-a3b:free", provider: "OpenRouter" },
  { name: "openrouter/aurora-alpha", provider: "OpenRouter" },
  { name: "upstage/solar-pro-3:free", provider: "OpenRouter" },
  { name: "arcee-ai/trinity-mini:free", provider: "OpenRouter" },
  { name: "nvidia/nemotron-nano-12b-v2-vl:free", provider: "OpenRouter" },
  { name: "groq/compound", provider: "Groq" },
  { name: "openai/gpt-oss-120b", provider: "Groq" },
  { name: "meta-llama/llama-4-scout-17b-16e-instruct", provider: "Groq" },
  { name: "qwen/qwen3-32b", provider: "Groq" },
  { name: "moonshotai/kimi-k2-instruct-0905", provider: "Groq" },
];

const API_BASE = "https://www.api.oji.dpdns.org/v1/api";
const SUPABASE_FN = "https://sawlpdzbovhgavlysrje.supabase.co/functions/v1";

function DocSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold bg-muted/30 hover:bg-muted/60 transition-colors text-left">
        <span className="flex items-center gap-2">{title}</span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 py-3 space-y-3 border-t border-border/50">{children}</div>}
    </div>
  );
}

function CodeBlock({ title, code, lang = "bash" }: { title?: string; code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {title && (
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-3 py-1.5">
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            <Terminal className="h-3 w-3" /> {lang}
          </span>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={copy}>
            {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}
      <pre className="overflow-x-auto p-3 font-mono text-[10px] sm:text-xs leading-relaxed whitespace-pre">{code}</pre>
    </div>
  );
}

export default function Dashboard() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpiry, setNewKeyExpiry] = useState("never");
  const [customExpiry, setCustomExpiry] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showUsernamePopup, setShowUsernamePopup] = useState(false);
  const [userId, setUserId] = useState("");
  const [defaultUsername, setDefaultUsername] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [previewKeyId, setPreviewKeyId] = useState<string | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
  const [pgModel, setPgModel] = useState(AI_MODELS[0].name);
  const [pgMessage, setPgMessage] = useState("Hello! Tell me a joke.");
  const [pgStream, setPgStream] = useState(false);
  const [pgResponse, setPgResponse] = useState("");
  const [pgLoading, setPgLoading] = useState(false);
  const [pgApiKey, setPgApiKey] = useState("");
  const [pgType, setPgType] = useState<"ai" | "upload">("ai");
  const [pgUploadFile, setPgUploadFile] = useState<File | null>(null);
  const [modelSearch, setModelSearch] = useState("");
  const [modelProvider, setModelProvider] = useState("all");
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchKeys = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`${SUPABASE_FN}/create-api-key`, {
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (Array.isArray(data)) setKeys(data);
  }, []);

  const fetchCoins = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from("user_coins").select("balance").eq("user_id", session.user.id).single();
    if (data) setCoins((data as Record<string, unknown>).balance as number);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);
      const { data: profile } = await supabase.from("profiles").select("username, email").eq("id", session.user.id).single();
      if (profile) {
        const p = profile as Record<string, unknown>;
        if (!p.username) {
          const name = session.user.user_metadata?.full_name || session.user.user_metadata?.name || (p.email as string)?.split("@")[0] || "user";
          setDefaultUsername(name);
          setShowUsernamePopup(true);
        }
      }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      if (roles?.some((r: Record<string, unknown>) => r.role === "admin" || r.role === "owner")) setIsAdmin(true);
    };
    init();
    fetchKeys();
    fetchCoins();
  }, [fetchKeys, fetchCoins]);

  const getExpiresAt = (): string | null => {
    if (newKeyExpiry === "never") return null;
    if (newKeyExpiry === "custom") return customExpiry ? new Date(customExpiry).toISOString() : null;
    const d = new Date();
    if (newKeyExpiry === "7d") d.setDate(d.getDate() + 7);
    else if (newKeyExpiry === "30d") d.setDate(d.getDate() + 30);
    else if (newKeyExpiry === "90d") d.setDate(d.getDate() + 90);
    else if (newKeyExpiry === "1y") d.setFullYear(d.getFullYear() + 1);
    return d.toISOString();
  };

  const createKey = async () => {
    if (!newKeyName.trim()) { toast({ title: "Masukkan nama key", variant: "destructive" }); return; }
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`${SUPABASE_FN}/create-api-key`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName, expires_at: getExpiresAt() }),
    });
    const data = await res.json();
    if (data.key) {
      toast({ title: "API Key dibuat!", description: `Key: ${data.key}` });
      setNewKeyName(""); setNewKeyExpiry("never"); setCustomExpiry("");
      fetchKeys();
    } else toast({ title: "Error", description: data.error || "Gagal", variant: "destructive" });
    setLoading(false);
  };

  const deleteKey = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(`${SUPABASE_FN}/create-api-key?id=${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${session.access_token}` },
    });
    toast({ title: "API Key dihapus" });
    fetchKeys();
  };

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isExpired = (k: ApiKey) => k.expires_at && new Date(k.expires_at) < new Date();
  const getKeyStatus = (k: ApiKey) => {
    if (!k.is_active) return { label: "Nonaktif", variant: "secondary" as const };
    if (isExpired(k)) return { label: "Expired", variant: "destructive" as const };
    return { label: "Aktif", variant: "default" as const };
  };

  const runPlayground = async () => {
    if (!pgApiKey) { toast({ title: "Pilih API key dulu", variant: "destructive" }); return; }
    setPgLoading(true); setPgResponse("");
    try {
      if (pgType === "ai") {
        const res = await fetch(`${SUPABASE_FN}/api/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${pgApiKey}` },
          body: JSON.stringify({ model: pgModel, stream: pgStream, messages: [{ role: "user", content: pgMessage }] }),
        });
        if (pgStream) {
          const reader = res.body?.getReader();
          const decoder = new TextDecoder();
          let result = "";
          while (reader) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            for (const line of chunk.split("\n").filter(l => l.startsWith("data: "))) {
              const d = line.slice(6);
              if (d === "[DONE]") continue;
              try { result += JSON.parse(d).choices?.[0]?.delta?.content || ""; setPgResponse(result); } catch { /* skip */ }
            }
          }
        } else {
          const data = await res.json();
          setPgResponse(JSON.stringify(data, null, 2));
        }
      } else if (pgType === "upload") {
        if (!pgUploadFile) {
          toast({ title: "Pilih file dulu", variant: "destructive" });
          setPgLoading(false);
          return;
        }
        const formData = new FormData();
        formData.append("file", pgUploadFile);
        const res = await fetch(`${SUPABASE_FN}/api/upload-file`, {
          method: "POST",
          headers: { Authorization: `Bearer ${pgApiKey}` },
          body: formData,
        });
        const data = await res.json();
        setPgResponse(JSON.stringify(data, null, 2));
      }
      fetchCoins();
    } catch (err: unknown) {
      setPgResponse(`Error: ${err instanceof Error ? err.message : "Error"}`);
    }
    setPgLoading(false);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/auth/login"); };

  const filteredModels = AI_MODELS.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(modelSearch.toLowerCase());
    const matchProvider = modelProvider === "all" || m.provider.toLowerCase() === modelProvider;
    return matchSearch && matchProvider;
  });

  const providers = [...new Set(AI_MODELS.map(m => m.provider))];

  return (
    <div className="min-h-screen bg-background">
      <UsernameDialog userId={userId} defaultName={defaultUsername} open={showUsernamePopup} onDone={() => setShowUsernamePopup(false)} />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2">
            <img src="/logo-rest-api.jpg" alt="OJI REST API" className="h-8 w-8 rounded-lg object-cover shadow-sm" />
            <h1 className="text-base font-bold sm:text-lg tracking-tight">Dashboard</h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {coins !== null && (
              <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1">
                <Coins className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">{coins.toLocaleString()}</span>
              </div>
            )}
            {isAdmin && (
              <Button variant="outline" size="sm" className="text-xs gap-1 h-8" onClick={() => navigate("/admin")}>
                <ShieldCheck className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Admin</span>
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-xs gap-1 h-8" onClick={() => navigate("/profile")}>
              <User className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Profil</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-xs gap-1 h-8" onClick={handleLogout}>
              <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-6 sm:px-4">
        <Tabs defaultValue="keys" className="space-y-4">
          <div className="overflow-x-auto">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:grid-cols-4 h-10">
              <TabsTrigger value="keys" className="text-xs sm:text-sm gap-1.5"><Key className="h-3.5 w-3.5" /> API Keys</TabsTrigger>
              <TabsTrigger value="docs" className="text-xs sm:text-sm gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Docs</TabsTrigger>
              <TabsTrigger value="playground" className="text-xs sm:text-sm gap-1.5"><Play className="h-3.5 w-3.5" /> Playground</TabsTrigger>
              <TabsTrigger value="models" className="text-xs sm:text-sm gap-1.5"><Cpu className="h-3.5 w-3.5" /> Models</TabsTrigger>
            </TabsList>
          </div>

          {/* API KEYS */}
          <TabsContent value="keys" className="space-y-4">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-1.5"><Key className="h-4 w-4 text-primary" /></div>
                  Buat API Key
                </CardTitle>
                <CardDescription className="text-xs">Prefix <code className="font-mono text-primary bg-primary/5 px-1 rounded">oji_</code></CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                  <Input placeholder="Nama key" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} onKeyDown={e => e.key === "Enter" && createKey()} className="text-sm" />
                  <Select value={newKeyExpiry} onValueChange={setNewKeyExpiry}>
                    <SelectTrigger className="w-full sm:w-[160px] text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Non-Expired</SelectItem>
                      <SelectItem value="7d">7 Hari</SelectItem>
                      <SelectItem value="30d">30 Hari</SelectItem>
                      <SelectItem value="90d">90 Hari</SelectItem>
                      <SelectItem value="1y">1 Tahun</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={createKey} disabled={loading} className="w-full sm:w-auto text-sm gap-1.5">
                    <Key className="h-3.5 w-3.5" /> {loading ? "..." : "Buat Key"}
                  </Button>
                </div>
                {newKeyExpiry === "custom" && <Input type="datetime-local" value={customExpiry} onChange={e => setCustomExpiry(e.target.value)} className="w-full sm:w-auto text-sm" />}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-1.5"><Shield className="h-4 w-4 text-primary" /></div>
                  API Keys Anda
                </CardTitle>
                <CardDescription className="text-xs">{keys.length} key terdaftar</CardDescription>
              </CardHeader>
              <CardContent>
                {keys.length === 0 ? (
                  <div className="py-10 text-center">
                    <Key className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Belum ada API key</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Buat key pertamamu di atas</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-6 px-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Nama</TableHead>
                          <TableHead className="text-xs">Key</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs hidden sm:table-cell">Expired</TableHead>
                          <TableHead className="text-xs hidden md:table-cell">Terakhir</TableHead>
                          <TableHead className="text-xs">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {keys.map(k => {
                          const status = getKeyStatus(k);
                          return (
                            <TableRow key={k.id} className={isExpired(k) ? "opacity-50" : ""}>
                              <TableCell className="text-xs font-medium max-w-[80px] truncate">{k.name}</TableCell>
                              <TableCell>
                                <code className="rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] sm:text-xs">
                                  {previewKeyId === k.id ? k.key : `${k.key.slice(0, 10)}...`}
                                </code>
                              </TableCell>
                              <TableCell><Badge variant={status.variant} className="text-[10px]">{status.label}</Badge></TableCell>
                              <TableCell className="text-[10px] text-muted-foreground hidden sm:table-cell">
                                {k.expires_at ? new Date(k.expires_at).toLocaleDateString("id-ID") : <span className="text-primary">∞</span>}
                              </TableCell>
                              <TableCell className="text-[10px] text-muted-foreground hidden md:table-cell">
                                {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "-"}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-0.5">
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => copy(k.key, k.id)}>
                                    {copiedId === k.id ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPreviewKeyId(previewKeyId === k.id ? null : k.id)}>
                                    {previewKeyId === k.id ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteKey(k.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* DOCS */}
          <TabsContent value="docs" className="space-y-4">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-1.5"><BookOpen className="h-4 w-4 text-primary" /></div>
                  API Reference
                </CardTitle>
                <CardDescription className="text-xs">Dokumentasi lengkap semua endpoint OJI REST API</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Base URL */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Base URL</h3>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="rounded-lg bg-card px-3 py-1.5 font-mono text-xs text-primary border border-primary/20 break-all">{API_BASE}</code>
                    <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => copy(API_BASE, "baseurl")}>
                      {copiedId === "baseurl" ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>

                <DocSection title="🔑 Authentication" defaultOpen>
                  <p className="text-xs text-muted-foreground">Semua request (kecuali status) membutuhkan API key di header:</p>
                  <CodeBlock title="Header" lang="http" code="Authorization: Bearer oji_your_api_key" />
                </DocSection>

                <DocSection title="🪙 Coin System">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      { icon: Coins, label: "User", value: "1000 coins/hari" },
                      { icon: Zap, label: "Admin/Owner", value: "1000 coins/5 jam" },
                      { icon: ArrowRight, label: "Per Request", value: "10 coins" },
                      { icon: Shield, label: "Error Refund", value: "Otomatis" },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-2 rounded-lg border border-border p-3">
                        <item.icon className="h-4 w-4 text-primary shrink-0" />
                        <div>
                          <p className="text-xs font-medium">{item.label}</p>
                          <p className="text-[10px] text-muted-foreground">{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </DocSection>

                <DocSection title="⚡ Rate Limiting">
                  <div className="rounded-lg bg-destructive/5 border border-destructive/10 p-3">
                    <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1">
                      <li>Maksimal <strong className="text-foreground">30 request/menit</strong> per API key</li>
                      <li>Pelanggaran dicatat: IP, User Agent, Domain</li>
                      <li>Pelanggaran berulang → pemblokiran otomatis</li>
                      <li>Response: <code className="bg-muted px-1 rounded text-[10px]">429 Too Many Requests</code></li>
                    </ul>
                  </div>
                </DocSection>

                {/* Chat Completions */}
                <DocSection title="POST /chat/completions — AI Chat" defaultOpen>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="text-[10px]">POST</Badge>
                    <code className="text-xs text-muted-foreground">/chat/completions</code>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Endpoint utama untuk chat AI, 100% kompatibel format OpenAI.</p>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead className="text-xs">Parameter</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Required</TableHead>
                        <TableHead className="text-xs">Keterangan</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        <TableRow><TableCell className="font-mono text-[10px]">model</TableCell><TableCell className="text-xs">string</TableCell><TableCell><Badge variant="default" className="text-[9px]">Ya</Badge></TableCell><TableCell className="text-xs">Model ID</TableCell></TableRow>
                        <TableRow><TableCell className="font-mono text-[10px]">messages</TableCell><TableCell className="text-xs">array</TableCell><TableCell><Badge variant="default" className="text-[9px]">Ya</Badge></TableCell><TableCell className="text-xs">{`[{role, content}]`}</TableCell></TableRow>
                        <TableRow><TableCell className="font-mono text-[10px]">stream</TableCell><TableCell className="text-xs">boolean</TableCell><TableCell><Badge variant="secondary" className="text-[9px]">Tidak</Badge></TableCell><TableCell className="text-xs">Enable SSE streaming</TableCell></TableRow>
                        <TableRow><TableCell className="font-mono text-[10px]">temperature</TableCell><TableCell className="text-xs">number</TableCell><TableCell><Badge variant="secondary" className="text-[9px]">Tidak</Badge></TableCell><TableCell className="text-xs">0-2, default 0.7</TableCell></TableRow>
                        <TableRow><TableCell className="font-mono text-[10px]">max_tokens</TableCell><TableCell className="text-xs">integer</TableCell><TableCell><Badge variant="secondary" className="text-[9px]">Tidak</Badge></TableCell><TableCell className="text-xs">Max output tokens</TableCell></TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <DocSection title="Contoh Respons (Non-Streaming)">
                    <CodeBlock title="Response" lang="json" code={`{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1700000000,
  "model": "qwen/qwen3-32b",
  "choices": [{
    "index": 0,
    "message": { "role": "assistant", "content": "Hello!" },
    "finish_reason": "stop"
  }],
  "usage": { "prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30 }
}`} />
                  </DocSection>
                  <DocSection title="Contoh Respons (Streaming SSE)">
                    <CodeBlock title="SSE Stream" lang="text" code={`data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":"stop"}]}

data: [DONE]`} />
                  </DocSection>
                </DocSection>

                {/* Models */}
                <DocSection title="GET /models — List Model">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-[10px]">GET</Badge>
                    <code className="text-xs text-muted-foreground">/models</code>
                  </div>
                  <CodeBlock title="Request" lang="bash" code={`curl ${API_BASE}/models \\
  -H "Authorization: Bearer oji_your_key"`} />
                  <DocSection title="Contoh Respons">
                    <CodeBlock title="Response" lang="json" code={`{
  "object": "list",
  "data": [
    { "id": "openai/gpt-4.1-mini", "object": "model", "owned_by": "github" },
    { "id": "qwen/qwen3-32b", "object": "model", "owned_by": "groq" }
  ]
}`} />
                  </DocSection>
                </DocSection>

                {/* Upload File */}
                <DocSection title="POST /upload-file — Upload File">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="text-[10px]">POST</Badge>
                    <code className="text-xs text-muted-foreground">/upload-file</code>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">Upload file dan dapatkan URL publik permanen.</p>
                  <CodeBlock title="Request" lang="bash" code={`curl ${API_BASE}/upload-file \\
  -H "Authorization: Bearer oji_your_key" \\
  -F "file=@photo.jpg"`} />
                  <DocSection title="Contoh Respons">
                    <CodeBlock title="Response" lang="json" code={`{
  "success": true,
  "file_name": "photo.jpg",
  "file_size": 245760,
  "mime_type": "image/jpeg",
  "url": "https://sawlpdzbovhgavlysrje.supabase.co/storage/v1/object/public/uploads/abc/photo.jpg",
  "path": "abc/1234_photo.jpg"
}`} />
                  </DocSection>
                </DocSection>

                {/* Create Website */}
                <DocSection title="POST /create-website — Deploy ke Vercel">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="text-[10px]">POST</Badge>
                    <code className="text-xs text-muted-foreground">/create-website</code>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">Deploy website dari GitHub repo atau file statis ke Vercel.</p>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead className="text-xs">Parameter</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Keterangan</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        <TableRow><TableCell className="font-mono text-[10px]">name</TableCell><TableCell className="text-xs">string</TableCell><TableCell className="text-xs">Nama project</TableCell></TableRow>
                        <TableRow><TableCell className="font-mono text-[10px]">github_url</TableCell><TableCell className="text-xs">string</TableCell><TableCell className="text-xs">URL repo GitHub (opsional)</TableCell></TableRow>
                        <TableRow><TableCell className="font-mono text-[10px]">files</TableCell><TableCell className="text-xs">array</TableCell><TableCell className="text-xs">{`[{file, data}]`} untuk static deploy</TableCell></TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <CodeBlock title="Request" lang="bash" code={`curl ${API_BASE}/create-website \\
  -H "Authorization: Bearer oji_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "mysite", "github_url": "https://github.com/user/repo"}'`} />
                  <DocSection title="Contoh Respons">
                    <CodeBlock title="Response" lang="json" code={`{
  "success": true,
  "project_name": "mysite",
  "url": "https://mysite.vercel.app",
  "deployment_url": "https://mysite-abc123.vercel.app"
}`} />
                  </DocSection>
                </DocSection>

                {/* Status */}
                <DocSection title="GET /status-sistem — Server Status (No Auth)">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-[10px]">GET</Badge>
                    <code className="text-xs text-muted-foreground">/status-sistem</code>
                    <Badge variant="outline" className="text-[9px]">No Auth</Badge>
                  </div>
                  <CodeBlock title="Request" lang="bash" code={`curl ${API_BASE}/status-sistem`} />
                  <DocSection title="Contoh Respons">
                    <CodeBlock title="Response" lang="json" code={`{
  "server_status": "online",
  "server_time": "2026-04-06 12:00:00",
  "server_response": "0.029 sec",
  "server_ping": "48 ms"
}`} />
                  </DocSection>
                </DocSection>

                <DocSection title="GET /status-api — API Status (No Auth)">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-[10px]">GET</Badge>
                    <code className="text-xs text-muted-foreground">/status-api</code>
                    <Badge variant="outline" className="text-[9px]">No Auth</Badge>
                  </div>
                  <CodeBlock title="Request" lang="bash" code={`curl ${API_BASE}/status-api`} />
                  <DocSection title="Contoh Respons">
                    <CodeBlock title="Response" lang="json" code={`{
  "status": "operational",
  "endpoints": {
    "openai/gpt-4.1-mini": "normal",
    "qwen/qwen3-32b": "normal",
    "upload-file": "normal",
    "create-website": "normal"
  },
  "timestamp": "2026-04-06T12:00:00.000Z"
}`} />
                  </DocSection>
                </DocSection>

                {/* Code Examples */}
                <div className="border-t border-border pt-4">
                  <h3 className="mb-3 text-sm font-semibold flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-primary" /> Contoh Kode
                  </h3>
                </div>

                <DocSection title="cURL">
                  <CodeBlock title="cURL" lang="bash" code={`curl ${API_BASE}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer oji_your_key" \\
  -d '{
    "model": "openai/gpt-4.1-mini",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`} />
                </DocSection>

                <DocSection title="Python (OpenAI SDK)">
                  <CodeBlock title="Python" lang="python" code={`from openai import OpenAI

client = OpenAI(
    base_url="${API_BASE}",
    api_key="oji_your_key"
)

response = client.chat.completions.create(
    model="openai/gpt-4.1-mini",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`} />
                </DocSection>

                <DocSection title="JavaScript / Node.js">
                  <CodeBlock title="JavaScript" lang="javascript" code={`const res = await fetch("${API_BASE}/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer oji_your_key"
  },
  body: JSON.stringify({
    model: "openai/gpt-4.1-mini",
    messages: [{ role: "user", content: "Hello!" }]
  })
});
const data = await res.json();
console.log(data.choices[0].message.content);`} />
                </DocSection>

                <DocSection title="Python — Streaming">
                  <CodeBlock title="Python Streaming" lang="python" code={`from openai import OpenAI

client = OpenAI(base_url="${API_BASE}", api_key="oji_your_key")

stream = client.chat.completions.create(
    model="openai/gpt-4.1-mini",
    messages=[{"role": "user", "content": "Hello!"}],
    stream=True
)
for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")`} />
                </DocSection>

                <DocSection title="Python — Upload File">
                  <CodeBlock title="Python Upload" lang="python" code={`import requests

res = requests.post(
    "${API_BASE}/upload-file",
    headers={"Authorization": "Bearer oji_your_key"},
    files={"file": open("photo.jpg", "rb")}
)
print(res.json()["url"])`} />
                </DocSection>

                {/* Error Codes */}
                <DocSection title="Error Codes">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead className="text-xs">Code</TableHead>
                        <TableHead className="text-xs">Description</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {[
                          { code: "400", desc: "Invalid request / missing params" },
                          { code: "401", desc: "API key invalid atau tidak ditemukan" },
                          { code: "402", desc: "Insufficient coins" },
                          { code: "403", desc: "API key expired atau user blacklisted" },
                          { code: "429", desc: "Rate limit exceeded (30 req/menit)" },
                          { code: "500", desc: "Server/provider error (coins refunded)" },
                        ].map(e => (
                          <TableRow key={e.code}>
                            <TableCell><Badge variant={e.code === "200" ? "default" : "destructive"} className="text-[10px] font-mono">{e.code}</Badge></TableCell>
                            <TableCell className="text-xs">{e.desc}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </DocSection>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PLAYGROUND */}
          <TabsContent value="playground" className="space-y-4">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-1.5"><Play className="h-4 w-4 text-primary" /></div>
                  API Playground
                </CardTitle>
                <CardDescription className="text-xs">Test semua API endpoint langsung dari browser</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <Button variant={pgType === "ai" ? "default" : "outline"} size="sm" className="text-xs gap-1.5 h-8" onClick={() => setPgType("ai")}>
                    <Cpu className="h-3.5 w-3.5" /> AI Chat
                  </Button>
                  <Button variant={pgType === "upload" ? "default" : "outline"} size="sm" className="text-xs gap-1.5 h-8" onClick={() => setPgType("upload")}>
                    <FileUp className="h-3.5 w-3.5" /> Upload File
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">API Key</label>
                    <Select value={pgApiKey} onValueChange={setPgApiKey}>
                      <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Pilih Key" /></SelectTrigger>
                      <SelectContent>
                        {keys.filter(k => k.is_active && !isExpired(k)).map(k => (
                          <SelectItem key={k.id} value={k.key} className="text-xs">{k.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {pgType === "ai" && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Model</label>
                      <Select value={pgModel} onValueChange={setPgModel}>
                        <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AI_MODELS.map(m => (
                            <SelectItem key={m.name} value={m.name} className="text-xs">
                              <span className="flex items-center gap-2">
                                {m.name}
                                <Badge variant="outline" className="text-[8px] px-1">{m.provider}</Badge>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {pgType === "ai" ? (
                  <>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Message</label>
                      <Textarea value={pgMessage} onChange={e => setPgMessage(e.target.value)} rows={3} className="text-sm resize-none" placeholder="Type your message..." />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" checked={pgStream} onChange={e => setPgStream(e.target.checked)} className="rounded border-border" />
                        <Zap className="h-3 w-3 text-primary" /> Stream
                      </label>
                      <Button onClick={runPlayground} disabled={pgLoading} size="sm" className="gap-1.5 h-8">
                        <Send className="h-3.5 w-3.5" /> {pgLoading ? "Running..." : "Send Request"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Pilih File</label>
                      <div className="rounded-lg border-2 border-dashed border-border p-4 text-center hover:border-primary/30 transition-colors">
                        <Input
                          type="file"
                          onChange={e => setPgUploadFile(e.target.files?.[0] || null)}
                          className="text-sm"
                        />
                        {pgUploadFile && (
                          <p className="mt-2 text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                            <FileUp className="h-3 w-3" />
                            {pgUploadFile.name} ({(pgUploadFile.size / 1024).toFixed(1)} KB)
                          </p>
                        )}
                      </div>
                    </div>
                    <Button onClick={runPlayground} disabled={pgLoading} size="sm" className="gap-1.5 h-8">
                      <Upload className="h-3.5 w-3.5" /> {pgLoading ? "Uploading..." : "Upload File"}
                    </Button>
                  </>
                )}

                {pgResponse && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="flex items-center justify-between bg-muted/30 border-b border-border/50 px-3 py-2">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Activity className="h-3 w-3" /> Response
                      </span>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={() => copy(pgResponse, "pg")}>
                        {copiedId === "pg" ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                    <pre className="max-h-80 overflow-auto p-3 font-mono text-[10px] sm:text-xs whitespace-pre-wrap leading-relaxed">{pgResponse}</pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* MODELS */}
          <TabsContent value="models" className="space-y-4">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-1.5"><Cpu className="h-4 w-4 text-primary" /></div>
                  Model Tersedia
                </CardTitle>
                <CardDescription className="text-xs">{filteredModels.length} dari {AI_MODELS.length} model</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Cari model..."
                      value={modelSearch}
                      onChange={e => setModelSearch(e.target.value)}
                      className="pl-9 text-sm h-9"
                    />
                  </div>
                  <Select value={modelProvider} onValueChange={setModelProvider}>
                    <SelectTrigger className="w-full sm:w-[140px] text-sm h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Providers</SelectItem>
                      {providers.map(p => (
                        <SelectItem key={p} value={p.toLowerCase()}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Provider summary */}
                <div className="flex flex-wrap gap-2">
                  {providers.map(p => {
                    const count = AI_MODELS.filter(m => m.provider === p).length;
                    return (
                      <Badge key={p} variant="outline" className="text-[10px] gap-1 cursor-pointer hover:bg-muted"
                        onClick={() => setModelProvider(modelProvider === p.toLowerCase() ? "all" : p.toLowerCase())}>
                        <Server className="h-2.5 w-2.5" /> {p} ({count})
                      </Badge>
                    );
                  })}
                </div>

                <div className="overflow-x-auto -mx-6 px-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Model</TableHead>
                        <TableHead className="text-xs">Provider</TableHead>
                        <TableHead className="text-xs">Tier</TableHead>
                        <TableHead className="text-xs">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredModels.map(m => (
                        <TableRow key={m.name}>
                          <TableCell className="font-mono text-[10px] sm:text-xs max-w-[200px] truncate">{m.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">
                              <Server className="h-2.5 w-2.5 mr-1" /> {m.provider}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] gap-0.5">
                              <Zap className="h-2.5 w-2.5" /> Free
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={() => copy(m.name, `model-${m.name}`)}>
                              {copiedId === `model-${m.name}` ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
