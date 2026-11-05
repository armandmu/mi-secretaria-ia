-- Ejecutar una sola vez en SQL Editor de Supabase.
-- La política RLS impide leer o modificar los datos de otros usuarios.
create table if not exists public.secretaria_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"tasks":[],"projects":[],"memories":[],"messages":[]}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.secretaria_state enable row level security;
create policy "Leer mi estado" on public.secretaria_state
  for select to authenticated using (auth.uid() = user_id);
create policy "Insertar mi estado" on public.secretaria_state
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Actualizar mi estado" on public.secretaria_state
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
