-- =============================================================================
--  光目覚ましプレウェイク
--  メインライト点灯10分前から、和風ライトを段階的に明るくする進捗を保存する。
-- =============================================================================
alter table public.alarms
  add column if not exists wafu_prewake_started_at timestamptz,
  add column if not exists wafu_prewake_step integer not null default 0;

do $$ begin
  alter table public.alarms
    add constraint chk_alarms_wafu_prewake_step
    check (wafu_prewake_step between 0 and 5);
exception when duplicate_object then null; end $$;

create index if not exists idx_alarms_wafu_prewake
  on public.alarms (fire_at, wafu_prewake_step)
  where is_enabled = true and triggered_at is null;

comment on column public.alarms.wafu_prewake_started_at is
  '光目覚ましの10分前から和風ライトのランプアップを開始した時刻';

comment on column public.alarms.wafu_prewake_step is
  '和風ライトのランプアップ進捗 (0=未開始, 1-5=明るさ段階)';
