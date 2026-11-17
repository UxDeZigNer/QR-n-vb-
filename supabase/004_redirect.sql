-- ============================================================
-- 004: Xidmət / əməkdaş yönləndirməsi
-- Ssenari: istifadəçi səhv xidmət seçib, növbəsi çatanda
-- operator onu digər xidmətə / əməkdaşa yönləndirir.
-- ============================================================

-- 1) Ticket-ə əməkdaş bağlanması
alter table public.tickets
  add column if not exists operator_id uuid references public.operators(id) on delete set null;

create index if not exists tickets_operator_idx on public.tickets (operator_id);

-- 2) call_next — çağırılan nömrə seçilən əməkdaşa bağlansın
--    (köhnə imzadan qurtarmaq üçün əvvəlcə silirik, yoxsa overloaded qalır)
drop function if exists public.call_next(uuid);

create or replace function public.call_next(
  p_branch_id uuid,
  p_operator_id uuid default null
) returns public.tickets
language plpgsql security definer as $$
declare
  v_ticket public.tickets;
begin
  -- Əvvəlki çağırılanı bağla
  update public.tickets
     set status = 'done', done_at = now()
   where branch_id = p_branch_id and status in ('called', 'serving');

  -- Növbətini çağır
  select * into v_ticket from public.tickets
   where branch_id = p_branch_id and status = 'waiting'
   order by seq asc
   limit 1
   for update;

  if not found then
    raise exception 'Növbədə gözləyən yoxdur';
  end if;

  update public.tickets
     set status = 'called',
         called_at = now(),
         operator_id = coalesce(p_operator_id, operator_id)
   where id = v_ticket.id
   returning * into v_ticket;

  return v_ticket;
end;
$$;

-- 3) redirect_ticket — xidmətə / əməkdaşa yönləndirmə
--    * gözləyən nömrə → status qalır, yalnız hədəf dəyişir
--    * çağırılmış nömrə → dərhal yeni hədəfə keçir (called_at yenilənir)
--    * p_back_to_queue=true → nömrə gözləmə siyahısına qaytarılır
create or replace function public.redirect_ticket(
  p_ticket_id uuid,
  p_service_id uuid default null,
  p_operator_id uuid default null,
  p_back_to_queue boolean default false
) returns public.tickets
language plpgsql security definer as $$
declare
  v_ticket public.tickets;
begin
  select * into v_ticket from public.tickets
   where id = p_ticket_id for update;

  if not found then
    raise exception 'Nömrə tapılmadı';
  end if;

  update public.tickets t
     set service_id  = coalesce(p_service_id, t.service_id),
         operator_id = coalesce(p_operator_id, t.operator_id),
         status = case
           when p_back_to_queue then 'waiting'
           when t.status in ('called', 'serving') then 'called'
           else t.status
         end,
         called_at = case
           when p_back_to_queue then null
           when t.status in ('called', 'serving') then now()
           else t.called_at
         end,
         done_at = case when p_back_to_queue then null else t.done_at end
   where t.id = p_ticket_id
   returning * into v_ticket;

  return v_ticket;
end;
$$;

-- 4) Yoxlama
select p.oid::regprocedure from pg_proc p
 where p.proname in ('call_next', 'redirect_ticket')
 order by p.proname, p.oid::regprocedure::text;
