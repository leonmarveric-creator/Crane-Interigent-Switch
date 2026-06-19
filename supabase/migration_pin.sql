-- =============================================================================
--  PIN方式への移行: reservations に unlock_pin を追加
--  Supabase SQL Editor で1回実行。
-- =============================================================================

alter table public.reservations
  add column if not exists unlock_pin text;

-- 既存予約でPIN未設定のものに4桁PINを付与
update public.reservations
  set unlock_pin = lpad((floor(random() * 10000))::int::text, 4, '0')
  where unlock_pin is null;

-- 今後の INSERT 用デフォルト (アプリ側が明示指定しなければ自動で4桁発行)
alter table public.reservations
  alter column unlock_pin set default lpad((floor(random() * 10000))::int::text, 4, '0');
