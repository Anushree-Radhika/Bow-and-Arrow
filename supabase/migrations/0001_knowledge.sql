-- Organizer: personal knowledge base for RAG (Supabase / PostgreSQL + pgvector)
-- Run in the Supabase SQL editor, or `supabase db push`.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------- folders
create table if not exists public.personal_folders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  icon        text not null default 'folder',
  created_at  timestamptz not null default now()
);

create index if not exists personal_folders_user_idx on public.personal_folders (user_id);

alter table public.personal_folders enable row level security;

create policy "folders: owner select" on public.personal_folders
  for select to authenticated using (user_id = (select auth.uid()));
create policy "folders: owner insert" on public.personal_folders
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "folders: owner update" on public.personal_folders
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "folders: owner delete" on public.personal_folders
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- chunks
create table if not exists public.knowledge_chunks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id     uuid references public.personal_folders (id) on delete cascade,
  source_title  text not null,
  page_number   int,
  content       text not null,
  embedding     extensions.vector(768) not null,
  created_at    timestamptz not null default now()
);

create index if not exists knowledge_chunks_user_folder_idx
  on public.knowledge_chunks (user_id, folder_id);
create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);

alter table public.knowledge_chunks enable row level security;

create policy "chunks: owner select" on public.knowledge_chunks
  for select to authenticated using (user_id = (select auth.uid()));

-- A user may only insert/update chunks for themselves, and only into a folder they own.
create policy "chunks: owner insert" on public.knowledge_chunks
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      folder_id is null
      or exists (
        select 1 from public.personal_folders f
        where f.id = folder_id and f.user_id = (select auth.uid())
      )
    )
  );
create policy "chunks: owner update" on public.knowledge_chunks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      folder_id is null
      or exists (
        select 1 from public.personal_folders f
        where f.id = folder_id and f.user_id = (select auth.uid())
      )
    )
  );
create policy "chunks: owner delete" on public.knowledge_chunks
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- vector search
-- SECURITY INVOKER: runs as the caller, so RLS applies. The explicit auth.uid() filter is a
-- second lock; even if someone later weakens a policy, this function still never crosses users.
create or replace function public.match_user_knowledge(
  query_embedding   extensions.vector(768),
  match_count       int    default 8,
  match_threshold   float  default 0.0,
  filter_folder_id  uuid   default null
)
returns table (
  id            uuid,
  folder_id     uuid,
  source_title  text,
  page_number   int,
  content       text,
  similarity    float
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    kc.id,
    kc.folder_id,
    kc.source_title,
    kc.page_number,
    kc.content,
    (1 - (kc.embedding <=> query_embedding))::float as similarity
  from public.knowledge_chunks kc
  where kc.user_id = auth.uid()
    and (filter_folder_id is null or kc.folder_id = filter_folder_id)
    and (1 - (kc.embedding <=> query_embedding)) >= match_threshold
  order by kc.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 50);
$$;

revoke all on function public.match_user_knowledge(extensions.vector, int, float, uuid) from public, anon;
grant execute on function public.match_user_knowledge(extensions.vector, int, float, uuid) to authenticated;
