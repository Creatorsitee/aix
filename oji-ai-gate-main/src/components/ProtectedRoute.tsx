import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    // Listen for auth state changes (handles OAuth callbacks with hash fragments)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setSession(session);
      if (event === 'SIGNED_OUT') navigate("/auth");
    });

    // Initial session check - don't redirect if hash is present (OAuth callback)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      if (!session && !window.location.hash.includes('access_token')) {
        navigate("/auth");
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [navigate]);

  if (session === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return session ? <>{children}</> : null;
}
