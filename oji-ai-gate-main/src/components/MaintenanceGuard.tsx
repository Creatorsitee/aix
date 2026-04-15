import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const EXEMPT_ROUTES = ["/maintenance"];

export default function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const check = async () => {
      try {
        const { data } = await supabase.from("app_settings").select("value").eq("key", "maintenance_mode").single();
        const enabled = data?.value && typeof data.value === "object" && (data.value as Record<string, boolean>).enabled;
        setIsMaintenance(!!enabled);
        if (enabled && !EXEMPT_ROUTES.includes(location.pathname)) {
          navigate("/maintenance");
        }
      } catch { /* ignore */ }
      setChecking(false);
    };
    check();
  }, [location.pathname, navigate]);

  if (checking) return null;
  if (isMaintenance && !EXEMPT_ROUTES.includes(location.pathname)) return null;

  return <>{children}</>;
}
