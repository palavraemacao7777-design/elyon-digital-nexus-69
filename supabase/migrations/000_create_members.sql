-- Migration: create members table (minimal columns required by upsert-member-profile)
CREATE TABLE IF NOT EXISTS public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  name text NOT NULL,
  phone text,
  checkout_id text,
  member_area_id text,
  status text DEFAULT 'active',
  password_hash text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
