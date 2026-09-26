-- =============================================================================
--  お父さんの送迎画面 (/driver) 用。何度実行しても安全。
--   ・予約ごとのお迎え情報 (場所・時刻・送迎なし・便名・飛行機の確認結果・準備済み)
--   ・よく使うお迎え場所
--   ・車内の音楽 (お迎え用／お見送り用 × 言語) と歌詞 (LRC)
--   ・鍵の電池の記録とお知らせ
--   ・設定 (デザイン・自動準備・飛行機の自動確認) と、飛行機確認の月の回数
--  ※ 先に migration_boot_voice.sql (app_settings) を実行しておくこと。
-- =============================================================================

-- 予約ごとのお迎え情報
alter table public.reservations
  add column if not exists pickup_place       text,          -- お迎え場所 (よく使う場所の名前)
  add column if not exists pickup_at          timestamptz,   -- お迎え時刻 (なければチェックイン時刻を目安)
  add column if not exists pickup_none        boolean not null default false, -- 送迎なし
  add column if not exists flight_no          text,          -- 便名 (入っている予約だけ飛行機を確認する)
  add column if not exists flight_info        jsonb,         -- 最後に確認した結果
  add column if not exists flight_checked_at  timestamptz,
  add column if not exists prepared_at        timestamptz;   -- お出迎え準備をした時刻 (自動・手動)

-- よく使うお迎え場所
create table if not exists public.driver_places (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  map_query   text,                       -- 地図で探すときの言葉 (空なら name)
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);
insert into public.driver_places (name, sort)
select v.name, v.sort from (values
  ('関西空港 第1ターミナル', 1), ('関西空港 第2ターミナル', 2), ('りんくうタウン駅', 3),
  ('京都駅 八条口', 4), ('京都駅 烏丸口', 5), ('伊丹空港', 6)
) as v(name, sort)
where not exists (select 1 from public.driver_places);

-- 車内の音楽
create table if not exists public.driver_tracks (
  id          uuid primary key default gen_random_uuid(),
  purpose     text not null check (purpose in ('in', 'out')),        -- in = お迎え用 / out = お見送り用
  lang        text not null check (lang in ('ja', 'en', 'zh', 'ko')),
  title       text not null,
  artist      text,
  file_path   text not null,               -- Storage (driver-music) の中のパス
  lrc         text,                        -- 時間付きの歌詞 (なければ NULL)
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_driver_tracks_list on public.driver_tracks (purpose, lang, sort);

-- 音楽ファイルの置き場所 (公開の読み取りのみ。書き込みはサーバから)
insert into storage.buckets (id, name, public)
values ('driver-music', 'driver-music', true)
on conflict (id) do update set public = true;

-- 鍵の電池の記録 (チェックイン3日前 / 空き部屋は2か月に1回)
create table if not exists public.lock_battery_logs (
  id          bigserial primary key,
  room_id     uuid not null references public.rooms(id) on delete cascade,
  battery     integer,
  locked      boolean,
  checked_at  timestamptz not null default now()
);
create index if not exists idx_lock_battery_room on public.lock_battery_logs (room_id, checked_at desc);

-- お知らせ (電池交換など)。解決したら resolved_at を入れる
create table if not exists public.driver_alerts (
  id          bigserial primary key,
  room_id     uuid references public.rooms(id) on delete cascade,
  kind        text not null,               -- 'battery'
  battery     integer,
  due_at      timestamptz,                 -- 関係するチェックイン時刻
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists idx_driver_alerts_open on public.driver_alerts (resolved_at, kind);

-- 飛行機確認の回数 (月ごと)
create table if not exists public.driver_flight_usage (
  month  text primary key,                 -- 'YYYY-MM'
  used   integer not null default 0
);

-- 設定
alter table public.app_settings
  add column if not exists driver_design        text    not null default 'hybrid',
  add column if not exists driver_auto_prep     boolean not null default true,
  add column if not exists driver_auto_prep_min integer not null default 30,
  add column if not exists driver_flight_auto   boolean not null default true,
  add column if not exists driver_battery_day   text;   -- 電池確認を最後に回した日 (JST)
do $$ begin
  alter table public.app_settings add constraint chk_driver_design check (driver_design in ('hybrid', 'bike'));
exception when duplicate_object then null; end $$;

-- service_role (サーバ) からのみアクセス
alter table public.driver_places      enable row level security;
alter table public.driver_tracks      enable row level security;
alter table public.lock_battery_logs  enable row level security;
alter table public.driver_alerts      enable row level security;
alter table public.driver_flight_usage enable row level security;

-- 確認
select 'driver ready' as status,
  (select count(*) from public.driver_places) as places,
  (select count(*) from public.driver_tracks) as tracks;
