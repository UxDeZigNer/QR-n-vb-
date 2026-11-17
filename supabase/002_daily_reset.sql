-- ============================================================
-- Gündəlik avtomatik sıfırlama (lazy — cron lazım deyil)
-- İlk skan zamanı: bugündürsə → sayğac 0-a sıfırlanır,
-- dünənki açıq ticket-lar 'done' edilir.
-- ============================================================

-- 1) Sayğaca tarix sütunu
alter table public.queue_counters
  add column if not exists last_reset_date date not null default current_date;

-- 2) Yeni filial yaradılanda tarix bugünsə olsun
create or replace function public.handle_new_branch()
returns trigger language plpgsql security definer as $$
begin
  insert into public.queue_counters (branch_id, last_seq, last_reset_date)
  values (new.id, 0, current_date)
  on conflict (branch_id) do nothing;
  return new;
end;
$$;

-- 3) join_queue — gündəlik sıfırlama yoxlaması
create or replace function public.join_queue(
  p_branch_id uuid,
  p_service_id uuid default null,
  p_name text default null,
  p_phone text default null
) returns public.tickets
language plpgsql security definer as $$
declare
  v_branch public.branches;
  v_seq int;
  v_code text;
  v_ticket public.tickets;
  v_new_day boolean;
begin
  select * into v_branch from public.branches
    where id = p_branch_id and is_active for update;
  if not found then
    raise exception 'Filial tapılmadı və ya aktiv deyil';
  end if;

  -- Gün dəyişibmi? (ilk skan zamanı yoxlanılır)
  select (last_reset_date < current_date) into v_new_day
    from public.queue_counters where branch_id = p_branch_id;

  if coalesce(v_new_day, false) then
    -- Dünənki nömrələri arxivə köçür:
    --  * seq mənfi unikal dəyərə çevrilir (unique constraint pozulmur,
    --    code 'A-1' olduğu kimi qalır, tarixçə qorunur)
    --  * açıq nömrələr 'done' edilir
    -- Mənfi dəyərlər həmişə unikal qalır: mövcud ən mənfidən aşağıdakı sıra nömrələri.
    with to_archive as (
      select id, status,
             row_number() over (order by joined_at desc, id) as rn
        from public.tickets
       where branch_id = p_branch_id and seq > 0
    ),
    base as (
      select coalesce((select min(seq) from public.tickets
                        where branch_id = p_branch_id and seq < 0), 0) as b
    )
    update public.tickets t
       set status = case when t.status in ('waiting','called','serving')
                         then 'done' else t.status end,
           done_at = case when t.status in ('waiting','called','serving')
                          then coalesce(t.done_at, now()) else t.done_at end,
           seq = base.b - to_archive.rn
      from to_archive, base
     where t.id = to_archive.id;

    -- Sayğacı sıfırla
    update public.queue_counters
       set last_seq = 0, last_reset_date = current_date
     where branch_id = p_branch_id;
  end if;

  -- Nömrə al (atomik +1)
  update public.queue_counters
     set last_seq = last_seq + 1,
         last_reset_date = current_date
   where branch_id = p_branch_id
   returning last_seq into v_seq;

  v_code := v_branch.prefix || '-' || v_seq;

  insert into public.tickets (branch_id, service_id, code, seq, visitor_name, visitor_phone)
  values (p_branch_id, p_service_id, v_code, v_seq, p_name, p_phone)
  returning * into v_ticket;

  return v_ticket;
end;
$$;

-- 4) Yoxlama nəticəsi
select c.branch_id, b.slug, c.last_seq, c.last_reset_date
  from public.queue_counters c
  join public.branches b on b.id = c.branch_id;
