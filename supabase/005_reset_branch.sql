-- Filial datalarını sıfırlama RPC (org sahibi öz filialının biletlərini silə bilsin)
-- RLS-də tickets üçün DELETE policy yoxdur — buna görə security definer RPC işlədirik.

create or replace function public.reset_branch(p_branch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Yalnız org sahibi öz filialını sıfırlaya bilər
  if not exists (
    select 1
    from public.branches b
    join public.orgs o on o.id = b.org_id
    where b.id = p_branch_id and o.owner_id = public.auth_uid()
  ) then
    raise exception 'Bu filialı sıfırlamaq icazəniz yoxdur';
  end if;

  delete from public.tickets where branch_id = p_branch_id;

  update public.queue_counters
    set last_seq = 0, last_reset_date = current_date
    where branch_id = p_branch_id;
end;
$$;
