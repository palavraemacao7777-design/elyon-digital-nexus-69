-- Enable RLS and policies for members
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to select their own member row
CREATE POLICY "Members: select own"
ON public.members
FOR SELECT
USING (auth.uid() = user_id);

-- Allow authenticated users to insert only rows where user_id == auth.uid()
CREATE POLICY "Members: insert own"
ON public.members
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow update only for own rows
CREATE POLICY "Members: update own"
ON public.members
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
