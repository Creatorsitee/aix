import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="mb-2 text-6xl font-bold text-primary">404</h1>
        <p className="mb-1 text-xl font-medium">Halaman Tidak Ditemukan</p>
        <p className="mb-6 text-muted-foreground">
          Path <code className="rounded bg-muted px-2 py-0.5 font-mono text-sm">{location.pathname}</code> tidak ada.
        </p>
        <Link to="/"><Button>Kembali ke Home</Button></Link>
      </div>
    </div>
  );
}
