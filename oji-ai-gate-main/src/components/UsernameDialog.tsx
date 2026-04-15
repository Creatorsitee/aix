import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Props {
  userId: string;
  defaultName: string;
  open: boolean;
  onDone: (username: string) => void;
}

export default function UsernameDialog({ userId, defaultName, open, onDone }: Props) {
  const [username, setUsername] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setUsername(defaultName);
  }, [defaultName]);

  const handleSave = async () => {
    if (!username.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username: username.trim() } satisfies TablesUpdate<"profiles">)
      .eq("id", userId);
    
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Username disimpan!" });
      onDone(username.trim());
    }
    setSaving(false);
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Selamat datang! 👋</DialogTitle>
          <DialogDescription>
            Pilih username untuk akun Anda. Bisa diubah nanti.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            maxLength={30}
          />
          <Button onClick={handleSave} disabled={saving || !username.trim()} className="w-full">
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
