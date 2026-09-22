-- =============================================================================
--  光目覚ましモード
--  Flame On と Horizon Rise を保存し、Horizon Rise の和風ライト自動消灯を管理する。
-- =============================================================================
alter table public.alarms
  add column if not exists wake_mode text not null default 'flame_on',
  add column if not exists wafu_auto_off_at timestamptz,
  add column if not exists wafu_auto_off_completed_at timestamptz;

do $$ begin
  alter table public.alarms
    add constraint chk_alarms_wake_mode
    check (wake_mode in ('flame_on', 'horizon_rise'));
exception when duplicate_object then null; end $$;

create index if not exists idx_alarms_wafu_auto_off
  on public.alarms (wafu_auto_off_at)
  where is_enabled = true
    and wake_mode = 'horizon_rise'
    and triggered_at is not null
    and wafu_auto_off_completed_at is null;

comment on column public.alarms.wake_mode is
  '光目覚まし種別: flame_on=設定時刻にメインライト、horizon_rise=10分前から和風ライト+5分後自動消灯';

comment on column public.alarms.wafu_auto_off_at is
  'Horizon Riseでメインライト点灯5分後に和風ライトだけを消す予定時刻';

comment on column public.alarms.wafu_auto_off_completed_at is
  'Horizon Riseの和風ライト自動消灯が成功した時刻';
