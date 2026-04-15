import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Maintenance() {
  const [searchParams] = useSearchParams();
  const [isMaintenance, setIsMaintenance] = useState(true);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "off") {
      setShowCodeInput(true);
    }

    // Check maintenance status
    supabase.from("app_settings").select("value").eq("key", "maintenance_mode").single()
      .then(({ data }) => {
        if (data?.value && typeof data.value === "object" && "enabled" in (data.value as Record<string, unknown>)) {
          setIsMaintenance(!!(data.value as Record<string, boolean>).enabled);
        }
      });
  }, [searchParams]);

  const handleDisable = async () => {
    if (code !== "ojisaputradev404/10/10/10") {
      setError("Invalid code");
      return;
    }
    // Disable maintenance via admin endpoint
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Login required");
      return;
    }
    const res = await fetch("https://sawlpdzbovhgavlysrje.supabase.co/functions/v1/admin?action=set_maintenance", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    const data = await res.json();
    if (data.success) {
      setIsMaintenance(false);
      window.location.href = "/";
    } else {
      setError(data.error || "Failed");
    }
  };

  if (showCodeInput) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h2 className="text-lg font-semibold text-gray-900">Nonaktifkan Maintenance</h2>
          <Input
            type="password"
            placeholder="Masukkan kode rahasia"
            value={code}
            onChange={e => setCode(e.target.value)}
            className="text-center"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button onClick={handleDisable} className="w-full">Nonaktifkan</Button>
        </div>
      </div>
    );
  }

  if (!isMaintenance) {
    window.location.href = "/";
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <p className="text-lg text-gray-600 font-medium">This deployment is temporarily paused</p>
    </div>
  );
}
