-- Bootstrap admin: Talbe@appdome.com
-- Run in Supabase SQL Editor after the user has signed up at least once.
-- https://supabase.com/dashboard/project/uojtjyvlioajsxmbgjjv/sql/new

INSERT INTO public.user_roles (id, role)
SELECT id, 'admin'
FROM auth.users
WHERE lower(email) = lower('Talbe@appdome.com')
ON CONFLICT (id) DO UPDATE
  SET role = 'admin',
      updated_at = now();

-- Verify:
SELECT u.email, ur.role, ur.updated_at
FROM auth.users u
JOIN public.user_roles ur ON ur.id = u.id
WHERE lower(u.email) = lower('Talbe@appdome.com');
