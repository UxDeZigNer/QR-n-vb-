-- ============================================================
-- QR Növbə Sistemi — veritabanı sxemi
-- Supabase SQL Editor-də bir dəfə işə salınır
-- ============================================================

-- Ümumi genişlənmələr
create extension if not exists "uuid-ossp";

-- ============================================================
-- Şirkət (org)
-- ============================================================
create table if not exists public.orgs (
  id uuid primary key default uuid_generate_v4(),
  name text not null default 'Yeni təşkilat',
  logo_url text,
  brand_color text not null default '#1b6ef5',
  owner_id uuid not null, -- auth.users.id
  created_at timestamptz not null default now()
);

-- ============================================================
-- Filial / növbə nöqtəsi
-- ============================================================
create table if not exists public.branches (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  slug text not null unique,          -- QR linki: /q/<slug>
  name text not null default 'Filial',
  address text,
  prefix text not null default 'A',   -- nömrə prefiksi: A-12
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Xidmətlər (növbəyə qoşulanda seçim)
-- ============================================================
create table if not exists public.services (
  id uuid primary key default uuid_generate_v4(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  avg_minutes int not null default 5,
  sort_order int not null default 0,
  is_active boolean not null default true
);

-- ============================================================
-- Operatorlar (personal)
-- ============================================================
create table if not exists public.operators (
  id uuid primary key default uuid_generate_v4(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  pin text,                          -- panelə PIN giriş (boş olsa sadə giriş)
  is_active boolean not null default true
);

-- ============================================================
-- Nömrələr (ziyarətçilər)
-- ============================================================
create type public.ticket_status as enum ('waiting', 'called', 'serving', 'done', 'skipped');

create table if not exists public.tickets (
  id uuid primary key default uuid_generate_v4(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  code text not null,                -- 'A-12'
  seq int not null,                  -- sıralı nömrə (artan)
  status public.ticket_status not null default 'waiting',
  visitor_name text,
  visitor_phone text,
  joined_at timestamptz not null default now(),
  called_at timestamptz,
  done_at timestamptz,
  unique (branch_id, seq)
);

create index if not exists tickets_branch_status_idx
  on public.tickets (branch_id, status, seq);

-- ============================================================
-- Növbənin cari sayğacı (atomik +1 üçün)
-- ============================================================
create table if not exists public.queue_counters (
  branch_id uuid primary key references public.branches(id) on delete cascade,
  last_seq int not null default 0
);

-- Yeni filial yaradılanda sayğac avtomatik
create or replace function public.handle_new_branch()
returns trigger language plpgsql security definer as $$
begin
  insert into public.queue_counters (branch_id, last_seq) values (new.id, 0)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_branch_created on public.branches;
create trigger on_branch_created
  after insert on public.branches
  for each row execute function public.handle_new_branch();

-- ============================================================
-- ZİYARƏTÇİ NÖMRƏ ALIR (atomik, yarış şəraiti yoxdur)
-- İki nəfər eyni saniyədə skan etsə belə fərqli nömrə alır
-- ============================================================
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
begin
  select * into v_branch from public.branches
    where id = p_branch_id and is_active for update;
  if not found then
    raise exception 'Filial tapılmadı və ya aktiv deyil';
  end if;

  -- Sayğacı kilidlə +1 et
  update public.queue_counters
     set last_seq = last_seq + 1
   where branch_id = p_branch_id
   returning last_seq into v_seq;

  v_code := v_branch.prefix || '-' || v_seq;

  insert into public.tickets (branch_id, service_id, code, seq, visitor_name, visitor_phone)
  values (p_branch_id, p_service_id, v_code, v_seq, p_name, p_phone)
  returning * into v_ticket;

  return v_ticket;
end;
$$;

-- ============================================================
-- OPERATOR «NÖVBƏTİNİ» ÇAĞIRIR
-- ============================================================
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
    raise exception 'Növbədə gözləyən yoxdur';
  end if;

  update public.tickets
     set status = 'called', called_at = now()
   where id = v_ticket.id
   returning * into v_ticket;

  return v_ticket;
end;
$$;

-- Geri çağır (əvvəlki nömrəyə qayıt)
create or replace function public.recall_ticket(p_ticket_id uuid)
returns public.tickets
language plpgsql security definer as $$
declare
  v_ticket public.tickets;
begin
  update public.tickets
     set status = 'called', called_at = now(), done_at = null
   where id = p_ticket_id
   returning * into v_ticket;
  return v_ticket;
end;
$$;

-- Gözləyənlərin sayı
create or replace function public.waiting_count(p_branch_id uuid)
returns int
language sql security definer as $$
  select count(*)::int from public.tickets
   where branch_id = p_branch_id and status = 'waiting';
$$;

-- ============================================================
-- Gözləmə zalı ekranı / panel üçün faydalı görünüş
-- ============================================================
create or replace view public.branch_live as
select
  b.id as branch_id,
  b.slug,
  b.name,
  b.is_active,
  (select count(*)::int from public.tickets t
     where t.branch_id = b.id and t.status = 'waiting') as waiting_count,
  (select t.code from public.tickets t
     where t.branch_id = b.id and t.status in ('called','serving')
     order by t.called_at desc limit 1) as current_code,
  (select max(t.called_at) from public.tickets t
     where t.branch_id = b.id and t.status = 'done') as last_called_at
from public.branches b;

-- ============================================================
-- RLS (Row Level Security)
-- Ziyarətçi yalnız oxuyur, çağırmalar RPC (security definer) ilə
-- ============================================================
alter table public.orgs enable row level security;
alter table public.branches enable row level security;
alter table public.services enable row level security;
alter table public.operators enable row level security;
alter table public.tickets enable row level security;
alter table public.queue_counters enable row level security;

-- Sessiya (JWT) varsa id
create or replace function public.auth_uid()
returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
$$;

-- Şirkət: sahibi idarə edir
create policy "orgs_select_own" on public.orgs
  for select using (owner_id = public.auth_uid());
create policy "orgs_insert_own" on public.orgs
  for insert with check (owner_id = public.auth_uid());
create policy "orgs_update_own" on public.orgs
  for update using (owner_id = public.auth_uid());

-- Filiallar: org sahibi idarə edir, hər kəs oxuya bilir (QR səhifəsi üçün)
create policy "branches_public_read" on public.branches
  for select using (true);
create policy "branches_owner_write" on public.branches
  for all using (
    exists (select 1 from public.orgs o
             where o.id = branches.org_id and o.owner_id = public.auth_uid())
  );

-- Xidmət/operatorlar: oxu açıq (ziyarətçi seçimini görməlidir), yazma org sahibi
create policy "services_read" on public.services for select using (true);
create policy "services_write" on public.services
  for all using (
    exists (select 1 from public.branches b join public.orgs o on o.id = b.org_id
             where b.id = services.branch_id and o.owner_id = public.auth_uid())
  );

create policy "operators_read" on public.operators for select using (true);
create policy "operators_write" on public.operators
  for all using (
    exists (select 1 from public.branches b join public.orgs o on o.id = b.org_id
             where b.id = operators.branch_id and o.owner_id = public.auth_uid())
  );

-- Ticket-lar: hamı oxuya bilir (real-time ekranlar), yazma yalnız RPC (security definer) və ya org sahibi
create policy "tickets_read" on public.tickets for select using (true);
create policy "tickets_owner_write" on public.tickets
  for update using (
    exists (select 1 from public.branches b join public.orgs o on o.id = b.org_id
             where b.id = tickets.branch_id and o.owner_id = public.auth_uid())
  );

-- Sayğac: yalnız oxu (artım RPC-də security definer ilə)
create policy "counters_read" on public.queue_counters for select using (true);
