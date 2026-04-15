import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save } from "lucide-react";

export default function Profile() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      setEmail(session.user.email || "");
      const { data } = await supabase.from("profiles").select("username").eq("id", session.user.id).single();
      if (data) setUsername((data as Record<string, unknown>).username as string || "");
    };
    load();
  }, [navigate]);

  const handleSave = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from("profiles").update({ username: username.trim() } satisfies TablesUpdate<"profiles">).eq("id", session.user.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Profil diperbarui!" });
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/logo-rest-api.jpg" alt="OJI REST API" className="h-8 w-8 rounded-lg object-cover" />
            <h1 className="text-lg font-bold">Profil</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-lg space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Informasi Profil</CardTitle>
            <CardDescription>Kelola data profil Anda</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Email</label>
              <Input value={email} disabled className="bg-muted" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Username</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" maxLength={30} />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
