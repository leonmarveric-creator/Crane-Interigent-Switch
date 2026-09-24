-- =============================================================================
--  Dream Fade モード (眠りにつく 30 分フェード)
--  和風ライトだけにして 30 分かけてゆっくり暗くし、最後に消灯する。
--  開始時刻と進み具合を部屋ごとに保存し、wake-alarm Cron が段階を進める。
--  何度実行しても安全。
-- =============================================================================
alter table public.rooms
  add column if not exists dream_fade_started_at timestamptz,
  add column if not exists dream_fade_step integer not null default 0;

comment on column public.rooms.dream_fade_started_at is
  'Dream Fade を開始した時刻 (実行中のみ。終了・他の灯りを操作すると null)';
comment on column public.rooms.dream_fade_step is
  'Dream Fade の進み具合 (0=開始直後, 1-15=暗くする段階)';

create index if not exists idx_rooms_dream_fade
  on public.rooms (dream_fade_started_at)
  where dream_fade_started_at is not null;
