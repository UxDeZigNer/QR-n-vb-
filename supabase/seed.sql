-- Test məlumatı: təşkilat + filial + xidmətlər + operator
-- (SQL Editor-də Run et — RLS-i admin kimi keçir, təhlükəsizliyə təsir etmir)

insert into public.orgs (id, name, owner_id, brand_color)
values ('00000000-0000-0000-0000-000000000001', 'Test Təşkilat', '00000000-0000-0000-0000-000000000001', '#1b6ef5')
on conflict (id) do nothing;

insert into public.branches (id, org_id, slug, name, address, prefix)
values
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'merkez', 'Mərkəz filial', 'Bakı, Nizami 1', 'A'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'westpark', 'West Park filial', 'Bakı, 28 May 15', 'B')
on conflict (id) do nothing;

insert into public.services (branch_id, name, avg_minutes, sort_order)
select '00000000-0000-0000-0000-000000000002', s.name, s.avg_minutes, s.sort_order
from (values ('Kassir', 3, 0), ('Mütəxəssis', 10, 1), ('Qəbul', 7, 2)) as s(name, avg_minutes, sort_order)
where not exists (select 1 from public.services where branch_id = '00000000-0000-0000-0000-000000000002');

insert into public.operators (branch_id, name)
values ('00000000-0000-0000-0000-000000000002', 'Operator 1')
on conflict do nothing;

-- Nəticələr
select b.slug, b.name, b.prefix,
       (select count(*) from public.services s where s.branch_id = b.id) as services
from public.branches b;
