-- =====================================================================================
-- Nasjah Atelier — Database lockdown (run ONCE in Supabase Dashboard -> SQL Editor)
--
-- !!! RUN THIS ONLY AFTER: SUPABASE_SERVICE_ROLE_KEY is set in Vercel and
--     https://nasjabhr.vercel.app/api/health returns "secureMode": true
--
-- Effect: browsers (anon / authenticated keys) can no longer read or write ANY business table
-- directly. All access goes through the backend (/api), which verifies the founder's login and
-- uses the service_role key (service_role bypasses RLS, so the backend keeps working).
-- This also stops any old app version still open on a device from overwriting the database.
-- =====================================================================================

-- 1) Make sure Row Level Security is ON for every business table
alter table if exists public.orders          enable row level security;
alter table if exists public.expenses        enable row level security;
alter table if exists public.inventory       enable row level security;
alter table if exists public.custom_profits  enable row level security;
alter table if exists public.store_settings  enable row level security;

-- 2) Drop every existing (permissive) policy on these tables
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('orders', 'expenses', 'inventory', 'custom_profits', 'store_settings')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 3) Revoke all table privileges from the public client roles (defence in depth on top of RLS)
do $$
declare t text;
begin
  foreach t in array array['orders', 'expenses', 'inventory', 'custom_profits', 'store_settings']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on table public.%I from anon, authenticated', t);
      execute format('grant all on table public.%I to service_role', t);
    end if;
  end loop;
end $$;

-- 4) Verification: should return ZERO rows (no policies left) ...
select tablename, policyname from pg_policies
where schemaname = 'public'
  and tablename in ('orders', 'expenses', 'inventory', 'custom_profits', 'store_settings');

-- ... and anon/authenticated should have no privileges left on these tables
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('orders', 'expenses', 'inventory', 'custom_profits', 'store_settings')
  and grantee in ('anon', 'authenticated');
