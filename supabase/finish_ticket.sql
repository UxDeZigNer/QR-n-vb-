-- finish_ticket: çağırılmış biletin xidmətini tamamla (status → done)
-- Necə işlədilir: Supabase Dashboard → SQL Editor → bu faylı yapışdır → Run
-- Panelə token lazım deyil (security definer + anon-a icazə)

create or replace function public.finish_ticket(p_ticket_id uuid)
returns public.tickets
language plpgsql security definer as $$
declare
  v_ticket public.tickets;
begin
  update public.tickets
     set status = 'done', done_at = now()
   where id = p_ticket_id
     and status in ('called', 'serving')
   returning * into v_ticket;

  if not found then
    raise exception 'Aktiv (çağırılmış) bilet tapılmadı';
  end if;

  return v_ticket;
end;
$$;

grant execute on function public.finish_ticket(uuid) to public;
