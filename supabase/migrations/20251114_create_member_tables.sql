-- Criar tabela members para armazenar membros da área de membros
CREATE TABLE IF NOT EXISTS public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  password_hash text NOT NULL,
  checkout_id uuid,
  payment_id uuid,
  plan_type text CHECK (plan_type IN ('essencial', 'avançado', 'premium', 'oferta_unica')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Policies for members
CREATE POLICY "Users can view their own member record" ON public.members
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR auth.uid() IN (
  SELECT user_id FROM checkouts WHERE id = checkout_id
));

CREATE POLICY "Service role can manage members" ON public.members
FOR ALL TO service_role
USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_members_email ON public.members(email);
CREATE INDEX IF NOT EXISTS idx_members_checkout_id ON public.members(checkout_id);
CREATE INDEX IF NOT EXISTS idx_members_payment_id ON public.members(payment_id);
CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.members(user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_members_updated_at
BEFORE UPDATE ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

---

-- Criar tabela member_access para associar membros aos produtos
CREATE TABLE IF NOT EXISTS public.member_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  granted_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.member_access ENABLE ROW LEVEL SECURITY;

-- Policies for member_access
CREATE POLICY "Members can view their own access" ON public.member_access
FOR SELECT TO authenticated
USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage member_access" ON public.member_access
FOR ALL TO service_role
USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_member_access_member_id ON public.member_access(member_id);
CREATE INDEX IF NOT EXISTS idx_member_access_product_id ON public.member_access(product_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_member_access_updated_at
BEFORE UPDATE ON public.member_access
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

---

-- Criar tabela member_settings para configurações da área de membros
CREATE TABLE IF NOT EXISTS public.member_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_area_id uuid NOT NULL REFERENCES public.member_areas(id) ON DELETE CASCADE,
  default_password_mode text DEFAULT 'random' CHECK (default_password_mode IN ('fixed', 'random', 'force_change')),
  default_fixed_password text,
  welcome_email_template text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(member_area_id)
);

-- Enable RLS
ALTER TABLE public.member_settings ENABLE ROW LEVEL SECURITY;

-- Policies for member_settings
CREATE POLICY "Owners can view their member_settings" ON public.member_settings
FOR SELECT TO authenticated
USING (member_area_id IN (SELECT id FROM member_areas WHERE user_id = auth.uid()));

CREATE POLICY "Owners can insert their member_settings" ON public.member_settings
FOR INSERT TO authenticated
WITH CHECK (member_area_id IN (SELECT id FROM member_areas WHERE user_id = auth.uid()));

CREATE POLICY "Owners can update their member_settings" ON public.member_settings
FOR UPDATE TO authenticated
USING (member_area_id IN (SELECT id FROM member_areas WHERE user_id = auth.uid()))
WITH CHECK (member_area_id IN (SELECT id FROM member_areas WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage member_settings" ON public.member_settings
FOR ALL TO service_role
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_member_settings_updated_at
BEFORE UPDATE ON public.member_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
