-- ギャラクシーモード自動OFF: ONから90分後にCronがOFFするための期限
alter table public.rooms
  add column if not exists galaxy_auto_off_at timestamptz;

comment on column public.rooms.galaxy_auto_off_at is
  'ギャラクシーモードONから90分後に自動OFFするための予定時刻 (UTC)';

create index if not exists idx_rooms_galaxy_auto_off_due
  on public.rooms (galaxy_auto_off_at)
  where galaxy_auto_off_at is not null;
