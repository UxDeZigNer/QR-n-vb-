-- call_next: cari biletə "done" verib növbətini çağırır.
-- YENİ: gözləyən yoxdursa exception atmaq əvəzinə cari biletə "done" verib null qaytarır.
-- (Əvvəlki versiyada exception rollback edirdi → bilet "called"-da əbədi qalırdı)
-- Necə işlədilir: Supabase Dashboard → SQL Editor → Run

create or replace function public.call_next(p_branch_id uuid)
returns public.tickets
language plpgsql security definer as $$
declare
  v_ticket public.tickets;
begin
  -- Əvvəl çağıran çağırılanı 'done' et
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
    -- YENİ: gözləyən yoxdur → cari bilet bitdi (yuxarıda update olundu), null qaytar
    return null;
  end if;

  update public.tickets
     set status = 'called', called_at = now()
   where id = v_ticket.id
   returning * into v_ticket;

  return v_ticket;
end;
$$;
