-- Create storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "Public read uploads" ON storage.objects FOR SELECT TO public USING (bucket_id = 'uploads');
CREATE POLICY "Auth users can upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'uploads');
CREATE POLICY "Users delete own uploads" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Blacklist table
CREATE TABLE IF NOT EXISTS public.blacklisted_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text DEFAULT '',
  blocked_at timestamptz NOT NULL DEFAULT now(),
  blocked_by uuid NOT NULL
);

CREATE POLICY "Admins manage blacklist" ON public.blacklisted_users FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Users read own blacklist" ON public.blacklisted_users FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- App settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE POLICY "Anyone can read app_settings" ON public.app_settings FOR SELECT TO public USING (true);
CREATE POLICY "Owner admin manage settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings (key, value) VALUES ('maintenance_mode', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Add columns to usage_logs
ALTER TABLE public.usage_logs ADD COLUMN IF NOT EXISTS locale text DEFAULT '';
ALTER TABLE public.usage_logs ADD COLUMN IF NOT EXISTS method text DEFAULT 'POST';

-- Update handle_new_user for owner role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_count integer;
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email);
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  INSERT INTO public.user_coins (user_id, balance, last_refill_at) VALUES (NEW.id, 1000, now());
  RETURN NEW;
END;
$$;

-- Owner inherits admin checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = _role OR (_role = 'admin' AND role = 'owner'))
  )
$$;