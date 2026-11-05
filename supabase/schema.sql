-- Mi Secretaria IA: configuración aplicada en Supabase (05/11/2026).
-- Tabla de usuario con acceso únicamente a la fila de auth.uid().
create table if not exists public.secretaria_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"tasks":[],"projects":[],"memories":[],"messages":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.secretaria_state enable row level security;

revoke all on table public.secretaria_state from public, anon;
grant select, insert, update on table public.secretaria_state to authenticated;

create policy "El usuario ve solo sus datos"
  on public.secretaria_state for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "El usuario crea solo sus datos"
  on public.secretaria_state for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "El usuario actualiza solo sus datos"
  on public.secretaria_state for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
