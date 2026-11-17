-- GÜNDƏLİK SIFIRLAMA TESTİ (v2 — fix ilə)
-- Əvvəl: sayğacı dünənə çəkirik → join_queue çağırırıq → nəticəni görürük.

do $$
declare
  v_branch uuid := '00000000-0000-0000-0000-000000000002'; -- merkez
  v_new_code text;
  v_before_open int;
  v_after_open int;
begin
  -- ƏVVƏL: açıq nömrə sayı
  select count(*) into v_before_open from public.tickets
   where branch_id = v_branch and status in ('waiting','called','serving');

  -- Sayğacı dünənə çək (gün dəyişdiyini simulyasiya et)
  update public.queue_counters
     set last_reset_date = current_date - 1
   where branch_id = v_branch;

  -- İlk skan — sıfırlama burada baş verir
  select code into v_new_code from public.join_queue(v_branch, null, 'Sıfırlama Testi', null);

  -- SONRA: açıq nömrə sayı (yalnız yeni 1 olmalıdır)
  select count(*) into v_after_open from public.tickets
   where branch_id = v_branch and status in ('waiting','called','serving');

  raise notice 'ƏVVƏL açıq: % | SONRA açıq: % | Yeni nömrə: %',
    v_before_open, v_after_open, v_new_code;

  if v_new_code = 'A-1' and v_after_open = 1 then
    raise notice '>>> TEST UĞURLU: sıfırlama işləyir <<<';
  else
    raise notice '>>> TEST MƏCĞUR: yeni=%, açıq=% (A-1 və 1 olmalıdır) <<<', v_new_code, v_after_open;
  end if;
end $$;

-- Son ticket-lar (A-1 yeni olmalı, köhnələr done + mənfi seq)
select code, status, seq, visitor_name
  from public.tickets
 where branch_id = '00000000-0000-0000-0000-000000000002'
 order by joined_at desc
 limit 8;

-- Sayğac
select last_seq, last_reset_date
  from public.queue_counters
 where branch_id = '00000000-0000-0000-0000-000000000002';
