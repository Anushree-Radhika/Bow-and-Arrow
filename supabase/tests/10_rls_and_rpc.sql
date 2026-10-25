-- Behavioural test of RLS + match_user_knowledge. Raises an exception on any failure.
-- Two users, A and B. Vectors are 768-dim: all zeros except one coordinate.

create or replace function pg_temp.vec(i int) returns extensions.vector language sql as $$
  select (array_fill(0::float, array[i - 1]) || array[1::float] || array_fill(0::float, array[768 - i]))::extensions.vector(768)
$$;

insert into auth.users values ('aaaaaaaa-0000-0000-0000-000000000001'), ('bbbbbbbb-0000-0000-0000-000000000002');
grant select, insert, update, delete on public.personal_folders, public.knowledge_chunks to authenticated;

-- ---- user A
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);

insert into public.personal_folders (id, name) values ('f0000000-0000-0000-0000-00000000000a', 'DSA');
insert into public.knowledge_chunks (folder_id, source_title, content, embedding) values
  ('f0000000-0000-0000-0000-00000000000a', 'graphs.pdf', 'Tarjan low-link values', pg_temp.vec(1)),
  ('f0000000-0000-0000-0000-00000000000a', 'graphs.pdf', 'Kosaraju two passes',     pg_temp.vec(2)),
  (null,                                   'loose.pdf',  'unfiled note',            pg_temp.vec(3));

do $$ begin
  if (select count(*) from public.match_user_knowledge(pg_temp.vec(1), 10)) <> 3 then
    raise exception 'A should see own 3 chunks'; end if;
  if (select content from public.match_user_knowledge(pg_temp.vec(1), 1)) <> 'Tarjan low-link values' then
    raise exception 'nearest neighbour wrong'; end if;
  if (select similarity from public.match_user_knowledge(pg_temp.vec(1), 1)) < 0.999 then
    raise exception 'similarity of identical vectors should be ~1'; end if;
  if (select count(*) from public.match_user_knowledge(pg_temp.vec(1), 10, 0.5)) <> 1 then
    raise exception 'threshold filter wrong'; end if;
  if (select count(*) from public.match_user_knowledge(pg_temp.vec(1), 10, 0.0, 'f0000000-0000-0000-0000-00000000000a')) <> 2 then
    raise exception 'folder filter wrong'; end if;
end $$;

-- ---- user B must see nothing of A's, and cannot write into A's folder
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);

do $$ begin
  if (select count(*) from public.personal_folders) <> 0 then raise exception 'B sees A folders'; end if;
  if (select count(*) from public.knowledge_chunks) <> 0 then raise exception 'B sees A chunks'; end if;
  if (select count(*) from public.match_user_knowledge(pg_temp.vec(1), 10)) <> 0 then
    raise exception 'B search leaked A data'; end if;
end $$;

do $$ begin
  begin
    insert into public.knowledge_chunks (folder_id, source_title, content, embedding)
    values ('f0000000-0000-0000-0000-00000000000a', 'evil.pdf', 'planted', pg_temp.vec(5));
    raise exception 'B was able to insert into A folder';
  exception when insufficient_privilege then null; -- RLS violation (42501) is the expected outcome
  end;
  begin
    insert into public.knowledge_chunks (user_id, source_title, content, embedding)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'evil.pdf', 'impersonate', pg_temp.vec(6));
    raise exception 'B was able to insert as A';
  exception when insufficient_privilege then null;
  end;
end $$;

-- B cannot update or delete A rows (silently affects 0 rows under RLS)
do $$ declare n int; begin
  update public.knowledge_chunks set content = 'hacked'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'B updated A rows'; end if;
  delete from public.knowledge_chunks; get diagnostics n = row_count;
  if n <> 0 then raise exception 'B deleted A rows'; end if;
end $$;

-- ---- anon cannot call the RPC at all
reset role;
set role anon;
do $$ begin
  begin
    perform * from public.match_user_knowledge(pg_temp.vec(1), 1);
    raise exception 'anon could call match_user_knowledge';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---- deleting a folder cascades to its chunks
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
delete from public.personal_folders where id = 'f0000000-0000-0000-0000-00000000000a';
do $$ begin
  if (select count(*) from public.knowledge_chunks) <> 1 then raise exception 'cascade failed'; end if;
end $$;
reset role;
select 'ALL SQL TESTS PASSED' as result;
