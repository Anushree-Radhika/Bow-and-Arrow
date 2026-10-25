-- Bow and Arrow: Persistent Study Maps Storage with Row-Level Security (RLS)
-- Run in the Supabase SQL editor: https://supabase.com/dashboard/project/_/sql

create table if not exists public.study_maps (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null,
  folder_id   uuid references public.personal_folders (id) on delete set null,
  nodes       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists study_maps_user_idx on public.study_maps (user_id);
create index if not exists study_maps_folder_idx on public.study_maps (folder_id);

alter table public.study_maps enable row level security;

create policy "maps: owner select" on public.study_maps
  for select to authenticated using (user_id = (select auth.uid()));

create policy "maps: owner insert" on public.study_maps
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "maps: owner update" on public.study_maps
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "maps: owner delete" on public.study_maps
  for delete to authenticated using (user_id = (select auth.uid()));
