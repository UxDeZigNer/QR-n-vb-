-- Realtime aktivləşdirmə:
-- SQL ilə yaradılan cədvəllər avtomatik olaraq realtime publication-a düşmür.

-- 1) Cədvəlləri realtime-ə əlavə et (artıq varsa xəta vermir, idarə olunur)
do $$
declare t text;
begin
  foreach t in array array['tickets','queue_counters','branches','services','operators','orgs']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice 'əlavə olundu: %', t;
    else
      raise notice 'artıq var: %', t;
    end if;
  end loop;
end $$;

-- 2) UPDATE/DELETE-də köhnə sətiri də göndər (status dəyişikliyi üçün vacib)
alter table public.tickets replica identity full;
alter table public.queue_counters replica identity full;

-- 3) Yoxlama: hansı cədvəllər realtimedədir
select tablename from pg_publication_tables
 where pubname = 'supabase_realtime' and schemaname = 'public'
 order by tablename;
