-- デバイス操作ログ
create table if not exists public.device_logs (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid references public.rooms(id) on delete cascade,
  reservation_id uuid,
  action         text not null,            -- unlock/lock/ac_on/ac_off/light_on/light_off
  source         text not null default 'guest', -- guest / admin / cron
  success        boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists idx_device_logs_created on public.device_logs (created_at desc);
create index if not exists idx_device_logs_room on public.device_logs (room_id, created_at desc);

-- service_role 経由のみ
alter table public.device_logs enable row level security;
