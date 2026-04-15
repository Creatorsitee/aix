
CREATE TABLE public.rate_limit_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  ip_address text NOT NULL,
  user_agent text DEFAULT '',
  domain text DEFAULT '',
  endpoint text DEFAULT '',
  violation_count integer DEFAULT 1,
  blocked boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limit_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage rate_limit_violations"
ON public.rate_limit_violations FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_rate_limit_ip ON public.rate_limit_violations(ip_address);
CREATE INDEX idx_rate_limit_user ON public.rate_limit_violations(user_id);
