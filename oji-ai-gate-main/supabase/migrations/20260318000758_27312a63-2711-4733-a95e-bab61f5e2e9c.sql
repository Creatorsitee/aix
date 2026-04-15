
-- Create user_coins table for daily coin system
CREATE TABLE public.user_coins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance integer NOT NULL DEFAULT 1000,
  last_refill_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_coins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own coins" ON public.user_coins
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all coins" ON public.user_coins
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Create provider_settings table for admin-managed API keys
CREATE TABLE public.provider_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  api_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage provider_settings" ON public.provider_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update handle_new_user to also create coins
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
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  
  INSERT INTO public.user_coins (user_id, balance, last_refill_at) VALUES (NEW.id, 1000, now());
  
  RETURN NEW;
END;
$$;

-- Backfill coins for existing users
INSERT INTO public.user_coins (user_id, balance, last_refill_at)
SELECT id, 1000, now() FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.user_coins)
ON CONFLICT (user_id) DO NOTHING;
