import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, Users, BarChart3, Settings, ArrowLeft, Trash2,
  Save, CheckCircle, XCircle, Ban, UserCheck, Wrench, Shield, AlertTriangle,
  Coins, Activity, Key, Search, Server, Clock, Globe, Zap, TrendingUp,
} from "lucide-react";

interface AdminUser {
  id: string; email: string | null; username: string | null; created_at: string;
  api_keys_count: number; active_keys: number; roles: string[]; coins: number;
  is_blacklisted: boolean;
}

interface UsageLog {
  id: string; user_id: string; model: string; provider: string;
  created_at: string; tokens_used: number; status_code: number;
  method: string; locale: string;
}

interface Stats {
  total_users: number; total_keys: number; total_requests: number;
  total_tokens: number; total_coins: number; blacklisted_users: number;
}

interface ProviderSetting {
  provider: string; api_key: string; is_active: boolean; updated_at: string;
}

interface RateLimitViolation {
  id: string; ip_address: string; user_agent: string; domain: string;
  endpoint: string; violation_count: number; blocked: boolean; created_at: string;
}

const BASE_URL = "https://sawlpdzbovhgavlysrje.supabase.co/functions/v1/admin";

type TabKey = "overview" | "users" | "usage" | "providers" | "maintenance" | "blacklist" | "ratelimit";

export default function Admin() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usage, setUsage] = useState<UsageLog[]>([]);
  const [tab, setTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [providerSettings, setProviderSettings] = useState<ProviderSetting[]>([]);
  const [envStatus, setEnvStatus] = useState<{ provider: string; hasEnv: boolean }[]>([]);
  const [newProviderName, setNewProviderName] = useState("");
  const [newProviderKey, setNewProviderKey] = useState("");
  const [savingProvider, setSavingProvider] = useState(false);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);
  const [blacklistReason, setBlacklistReason] = useState("");
  const [violations, setViolations] = useState<RateLimitViolation[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth/login"); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      const userRoles = (roles || []).map((r: Record<string, unknown>) => r.role as string);
      if (!userRoles.includes("admin") && !userRoles.includes("owner")) {
        toast({ title: "Akses ditolak", variant: "destructive" });
        navigate("/dashboard");
        return;
      }
      setIsOwner(userRoles.includes("owner"));
      setAuthorized(true);
    };
    checkAdmin();
  }, [navigate, toast]);

  const fetchData = useCallback(async (action: string, method = "GET", body?: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const opts: RequestInit = {
      method: method === "GET" ? "GET" : "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE_URL}?action=${action}`, opts);
    if (res.status === 403) { toast({ title: "Forbidden", variant: "destructive" }); return null; }
    return res.json();
  }, [toast]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [s, u, lg, ps, mt] = await Promise.all([
      fetchData("stats"), fetchData("users"), fetchData("usage"),
      fetchData("provider_settings"), fetchData("get_maintenance"),
    ]);
    if (s) setStats(s);
    if (u) setUsers(u);
    if (lg) setUsage(lg);
    if (ps) { setProviderSettings(ps.settings || []); setEnvStatus(ps.env_status || []); }
    if (mt) setMaintenanceEnabled(!!mt.enabled);
    const { data: viol } = await supabase.from("rate_limit_violations").select("*").order("created_at", { ascending: false }).limit(100);
    if (viol) setViolations(viol as RateLimitViolation[]);
    setLoading(false);
  }, [fetchData]);

  useEffect(() => {
    if (authorized) loadAll();
  }, [authorized, loadAll]);

  const saveProvider = async () => {
    if (!newProviderName || !newProviderKey) { toast({ title: "Isi provider dan key", variant: "destructive" }); return; }
    setSavingProvider(true);
    const result = await fetchData("update_provider", "POST", { provider: newProviderName, api_key: newProviderKey });
    if (result?.success) {
      toast({ title: "Provider key disimpan!" });
      setNewProviderName(""); setNewProviderKey("");
      const ps = await fetchData("provider_settings");
      if (ps) { setProviderSettings(ps.settings || []); setEnvStatus(ps.env_status || []); }
    } else toast({ title: "Error", description: result?.error, variant: "destructive" });
    setSavingProvider(false);
  };

  const deleteProvider = async (provider: string) => {
    await fetchData("delete_provider", "POST", { provider });
    toast({ title: "Provider key dihapus" });
    const ps = await fetchData("provider_settings");
    if (ps) { setProviderSettings(ps.settings || []); setEnvStatus(ps.env_status || []); }
  };

  const toggleMaintenance = async () => {
    if (!isOwner) { toast({ title: "Hanya owner", variant: "destructive" }); return; }
    setTogglingMaintenance(true);
    const result = await fetchData("set_maintenance", "POST", { enabled: !maintenanceEnabled });
    if (result?.success) {
      setMaintenanceEnabled(!maintenanceEnabled);
      toast({ title: maintenanceEnabled ? "Maintenance OFF" : "Maintenance ON" });
    }
    setTogglingMaintenance(false);
  };

  const blacklistUser = async (userId: string) => {
    const result = await fetchData("blacklist_user", "POST", { user_id: userId, reason: blacklistReason });
    if (result?.success) { toast({ title: "User di-blacklist" }); setBlacklistReason(""); loadAll(); }
  };

  const unblacklistUser = async (userId: string) => {
    const result = await fetchData("unblacklist_user", "POST", { user_id: userId });
    if (result?.success) { toast({ title: "User unblocked" }); loadAll(); }
  };

  const setRole = async (userId: string, role: string) => {
    if (!isOwner) { toast({ title: "Hanya owner", variant: "destructive" }); return; }
    const result = await fetchData("set_role", "POST", { user_id: userId, role });
    if (result?.success) { toast({ title: `Role → ${role}` }); loadAll(); }
    else toast({ title: "Error", description: result?.error, variant: "destructive" });
  };

  if (!authorized || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: typeof Users }[] = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "users", label: "Users", icon: Users },
    { key: "usage", label: "Usage", icon: Activity },
    { key: "providers", label: "Providers", icon: Server },
    { key: "blacklist", label: "Blacklist", icon: Ban },
    { key: "ratelimit", label: "Rate Limit", icon: Shield },
    { key: "maintenance", label: "Maintenance", icon: Wrench },
  ];

  const filteredUsers = users.filter(u =>
    (u.email || "").toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.username || "").toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-primary/10 p-1.5">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold sm:text-lg tracking-tight">Admin Panel</h1>
              {isOwner && <span className="text-[10px] text-primary font-medium">Owner Access</span>}
            </div>
          </div>
          <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-3 py-6 sm:px-4">
        {/* Tab Navigation */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map(t => (
            <Button key={t.key} variant={tab === t.key ? "default" : "ghost"} size="sm"
              className={`text-[10px] sm:text-xs whitespace-nowrap gap-1.5 shrink-0 h-8 ${tab === t.key ? "" : "hover:bg-muted"}`}
              onClick={() => setTab(t.key)}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </Button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && stats && (
          <div className="space-y-4">
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Users", value: stats.total_users, icon: Users, color: "text-blue-500" },
                { label: "API Keys", value: stats.total_keys, icon: Key, color: "text-primary" },
                { label: "Requests", value: stats.total_requests, icon: Activity, color: "text-orange-500" },
                { label: "Tokens", value: stats.total_tokens.toLocaleString(), icon: Zap, color: "text-yellow-500" },
                { label: "Total Coins", value: stats.total_coins.toLocaleString(), icon: Coins, color: "text-primary" },
                { label: "Blacklisted", value: stats.blacklisted_users, icon: Ban, color: "text-destructive" },
              ].map(s => (
                <Card key={s.label} className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{s.label}</span>
                      <s.icon className={`h-4 w-4 ${s.color}`} />
                    </div>
                    <div className="text-xl font-bold sm:text-2xl">{s.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Recent activity summary */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" /> Top Models
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const modelCounts: Record<string, number> = {};
                    usage.forEach(u => { modelCounts[u.model] = (modelCounts[u.model] || 0) + 1; });
                    const top = Object.entries(modelCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
                    return top.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No data</p>
                    ) : (
                      <div className="space-y-2">
                        {top.map(([model, count]) => (
                          <div key={model} className="flex items-center justify-between">
                            <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[180px]">{model}</span>
                            <Badge variant="secondary" className="text-[10px]">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" /> Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {usage.slice(0, 5).map(u => (
                    <div key={u.id} className="flex items-center justify-between py-1.5">
                      <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[140px]">{u.model}</span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={u.status_code === 200 ? "default" : "destructive"} className="text-[9px]">{u.status_code}</Badge>
                        <span className="text-[9px] text-muted-foreground">{new Date(u.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* USERS */}
        {tab === "users" && (
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-1.5"><Users className="h-4 w-4 text-primary" /></div>
                Semua Pengguna
              </CardTitle>
              <CardDescription className="text-xs">{filteredUsers.length} dari {users.length} terdaftar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Cari email atau username..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="pl-9 text-sm h-9" />
                </div>
                <Input placeholder="Alasan blacklist (opsional)" value={blacklistReason} onChange={e => setBlacklistReason(e.target.value)} className="text-sm h-9 sm:max-w-[200px]" />
              </div>

              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Username</TableHead>
                      <TableHead className="text-xs">Keys</TableHead>
                      <TableHead className="text-xs">Coins</TableHead>
                      <TableHead className="text-xs">Role</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map(u => (
                      <TableRow key={u.id} className={u.is_blacklisted ? "opacity-50 bg-destructive/5" : ""}>
                        <TableCell className="font-mono text-[10px] max-w-[120px] truncate">{u.email || "-"}</TableCell>
                        <TableCell className="text-xs hidden sm:table-cell">{u.username || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] gap-0.5">
                            <Key className="h-2.5 w-2.5" /> {u.active_keys}/{u.api_keys_count}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-medium flex items-center gap-0.5">
                            <Coins className="h-3 w-3 text-primary" /> {u.coins}
                          </span>
                        </TableCell>
                        <TableCell>
                          {isOwner ? (
                            <Select defaultValue={u.roles[0] || "user"} onValueChange={v => setRole(u.id, v)}>
                              <SelectTrigger className="h-7 w-[80px] text-[10px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user" className="text-xs">User</SelectItem>
                                <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                                <SelectItem value="owner" className="text-xs">Owner</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            u.roles.map(r => (
                              <Badge key={r} variant={r === "owner" ? "default" : r === "admin" ? "secondary" : "outline"} className="mr-0.5 text-[10px]">{r}</Badge>
                            ))
                          )}
                        </TableCell>
                        <TableCell>
                          {u.is_blacklisted ? (
                            <Badge variant="destructive" className="text-[10px] gap-0.5"><Ban className="h-2.5 w-2.5" /> Blocked</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] gap-0.5 text-primary border-primary/30"><CheckCircle className="h-2.5 w-2.5" /> Active</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {u.is_blacklisted ? (
                            <Button variant="outline" size="sm" className="h-6 text-[10px] gap-0.5" onClick={() => unblacklistUser(u.id)}>
                              <UserCheck className="h-3 w-3" /> Unblock
                            </Button>
                          ) : (
                            <Button variant="destructive" size="sm" className="h-6 text-[10px] gap-0.5" onClick={() => blacklistUser(u.id)}>
                              <Ban className="h-3 w-3" /> Block
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* USAGE */}
        {tab === "usage" && (
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-1.5"><Activity className="h-4 w-4 text-primary" /></div>
                Usage Logs
              </CardTitle>
              <CardDescription className="text-xs">{usage.length} request terakhir</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Model</TableHead>
                      <TableHead className="text-xs">Provider</TableHead>
                      <TableHead className="text-xs">Method</TableHead>
                      <TableHead className="text-xs">Tokens</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Waktu</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usage.map(u => (
                      <TableRow key={u.id}>
                        <TableCell className="font-mono text-[10px] max-w-[150px] truncate">{u.model}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] gap-0.5">
                            <Server className="h-2.5 w-2.5" /> {u.provider}
                          </Badge>
                        </TableCell>
                        <TableCell><Badge variant={u.method === "GET" ? "outline" : "default"} className="text-[10px]">{u.method || "POST"}</Badge></TableCell>
                        <TableCell className="text-xs">{u.tokens_used}</TableCell>
                        <TableCell>
                          <Badge variant={u.status_code === 200 ? "default" : "destructive"} className="text-[10px] gap-0.5">
                            {u.status_code === 200 ? <CheckCircle className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                            {u.status_code}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground hidden sm:table-cell">{new Date(u.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PROVIDERS */}
        {tab === "providers" && (
          <div className="space-y-4">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-1.5"><Server className="h-4 w-4 text-primary" /></div>
                  Provider API Keys
                </CardTitle>
                <CardDescription className="text-xs">Kelola API key untuk setiap provider AI</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Environment Variables</h4>
                  <div className="flex flex-wrap gap-2">
                    {envStatus.map(e => (
                      <Badge key={e.provider} variant={e.hasEnv ? "default" : "secondary"} className="text-[10px] gap-1">
                        {e.hasEnv ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {e.provider}
                      </Badge>
                    ))}
                  </div>
                </div>

                {providerSettings.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Custom Keys</h4>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Provider</TableHead>
                            <TableHead className="text-xs">API Key</TableHead>
                            <TableHead className="text-xs">Updated</TableHead>
                            <TableHead className="text-xs">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {providerSettings.map(ps => (
                            <TableRow key={ps.provider}>
                              <TableCell className="text-xs font-medium">{ps.provider}</TableCell>
                              <TableCell className="font-mono text-[10px]">{ps.api_key.slice(0, 12)}...</TableCell>
                              <TableCell className="text-[10px] text-muted-foreground">{new Date(ps.updated_at).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteProvider(ps.provider)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                <div className="border-t border-border pt-4">
                  <h4 className="mb-2 text-xs font-medium uppercase tracking-wider">Tambah / Update Provider Key</h4>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Select value={newProviderName} onValueChange={setNewProviderName}>
                      <SelectTrigger className="w-full sm:w-[160px] text-sm h-9"><SelectValue placeholder="Pilih Provider" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openrouter">OpenRouter</SelectItem>
                        <SelectItem value="groq">Groq</SelectItem>
                        <SelectItem value="github">GitHub Models</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="password" placeholder="API Key" value={newProviderKey} onChange={e => setNewProviderKey(e.target.value)} className="text-sm h-9" />
                    <Button onClick={saveProvider} disabled={savingProvider} size="sm" className="gap-1.5 h-9">
                      <Save className="h-3.5 w-3.5" /> {savingProvider ? "..." : "Simpan"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* BLACKLIST */}
        {tab === "blacklist" && (
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="rounded-lg bg-destructive/10 p-1.5"><Ban className="h-4 w-4 text-destructive" /></div>
                Blacklisted Users
              </CardTitle>
              <CardDescription className="text-xs">User yang di-blacklist tidak bisa mengakses API dan website</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const blocked = users.filter(u => u.is_blacklisted);
                if (blocked.length === 0) return (
                  <div className="py-10 text-center">
                    <Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground/20" />
                    <p className="text-sm text-muted-foreground">Tidak ada user yang di-blacklist</p>
                  </div>
                );
                return (
                  <div className="overflow-x-auto -mx-6 px-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Email</TableHead>
                          <TableHead className="text-xs">Username</TableHead>
                          <TableHead className="text-xs">Role</TableHead>
                          <TableHead className="text-xs">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {blocked.map(u => (
                          <TableRow key={u.id}>
                            <TableCell className="font-mono text-[10px] max-w-[120px] truncate">{u.email || "-"}</TableCell>
                            <TableCell className="text-xs">{u.username || "-"}</TableCell>
                            <TableCell>{u.roles.map(r => <Badge key={r} variant="outline" className="text-[10px] mr-0.5">{r}</Badge>)}</TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-0.5" onClick={() => unblacklistUser(u.id)}>
                                <UserCheck className="h-3 w-3" /> Unblock
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* RATE LIMIT */}
        {tab === "ratelimit" && (
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-1.5"><Shield className="h-4 w-4 text-primary" /></div>
                Rate Limit Violations
              </CardTitle>
              <CardDescription className="text-xs">Log pelanggaran rate-limit</CardDescription>
            </CardHeader>
            <CardContent>
              {violations.length === 0 ? (
                <div className="py-10 text-center">
                  <Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">Tidak ada pelanggaran</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">IP</TableHead>
                        <TableHead className="text-xs hidden sm:table-cell">Domain</TableHead>
                        <TableHead className="text-xs hidden md:table-cell">User Agent</TableHead>
                        <TableHead className="text-xs">Endpoint</TableHead>
                        <TableHead className="text-xs">Count</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs hidden sm:table-cell">Waktu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {violations.map(v => (
                        <TableRow key={v.id} className={v.blocked ? "bg-destructive/5" : ""}>
                          <TableCell className="font-mono text-[10px]">{v.ip_address}</TableCell>
                          <TableCell className="text-[10px] hidden sm:table-cell truncate max-w-[100px]">{v.domain || "-"}</TableCell>
                          <TableCell className="text-[10px] hidden md:table-cell truncate max-w-[120px]">{v.user_agent || "-"}</TableCell>
                          <TableCell className="text-[10px] font-mono truncate max-w-[100px]">{v.endpoint || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={v.violation_count > 5 ? "destructive" : "secondary"} className="text-[10px]">{v.violation_count}</Badge>
                          </TableCell>
                          <TableCell>
                            {v.blocked ? (
                              <Badge variant="destructive" className="text-[9px] gap-0.5"><AlertTriangle className="h-2.5 w-2.5" /> Blocked</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px]">OK</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-[10px] text-muted-foreground hidden sm:table-cell">{new Date(v.created_at).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* MAINTENANCE */}
        {tab === "maintenance" && (
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-1.5"><Wrench className="h-4 w-4 text-primary" /></div>
                Mode Maintenance
              </CardTitle>
              <CardDescription className="text-xs">
                {isOwner ? "Aktifkan atau nonaktifkan mode maintenance" : "Hanya owner yang bisa mengubah"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border p-5">
                <div>
                  <p className="text-sm font-semibold">Maintenance Mode</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {maintenanceEnabled ? "Website dalam mode maintenance" : "Website berjalan normal"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={maintenanceEnabled ? "destructive" : "default"} className="text-xs gap-1">
                    {maintenanceEnabled ? <><AlertTriangle className="h-3 w-3" /> ON</> : <><CheckCircle className="h-3 w-3" /> OFF</>}
                  </Badge>
                  {isOwner && (
                    <Switch
                      checked={maintenanceEnabled}
                      onCheckedChange={toggleMaintenance}
                      disabled={togglingMaintenance}
                    />
                  )}
                </div>
              </div>
              {maintenanceEnabled && (
                <div className="rounded-xl bg-destructive/5 border border-destructive/10 p-4">
                  <p className="text-xs text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                      Website menampilkan halaman maintenance. Nonaktifkan via{" "}
                      <code className="font-mono bg-destructive/10 px-1.5 py-0.5 rounded">/maintenance?mode=off</code>
                    </span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
