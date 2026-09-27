-- =============================================================================
--  車内 iPad (お客さん用の画面 /cabin) と、お父さんのスマホからの送迎開始
--    ・cabin_devices : 車の iPad (1号車・2号車…)。GPS があるかは iPad が自動で報告
--    ・cabin_trips   : 送迎 (スマホの「出発」で作る → iPad が表示)。スマホの位置もここに入る
--    ・driver_tracks : 「⚡ BOOST 用」の曲 と 開始位置 (秒)
--    ・rooms         : iPad に出す部屋の写真 と エアコン・照明・Wi-Fi の位置
--  何度実行しても大丈夫です。
-- =============================================================================

create table if not exists public.cabin_devices (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  has_gps      boolean,                        -- null = まだ分からない
  last_seen_at timestamptz,
  sort         integer not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.cabin_trips (
  id             uuid primary key default gen_random_uuid(),
  device_id      uuid references public.cabin_devices(id) on delete set null,
  reservation_id uuid,
  direction      text not null check (direction in ('in', 'out')),     -- in = お迎え / out = お見送り
  place_key      text not null,                                        -- kix / kix2 / rinku / r833 / hineno / other
  place_name     text,
  place_lat      double precision,
  place_lng      double precision,
  room_id        uuid,
  guest_lang     text not null default 'en',
  ac_mode        text not null default 'cool' check (ac_mode in ('cool', 'heat', 'none')),
  status         text not null default 'active' check (status in ('active', 'ended')),
  phone_lat      double precision,
  phone_lng      double precision,
  phone_speed    real,                                                 -- km/h
  phone_at       timestamptz,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz
);
create index if not exists idx_cabin_trips_active on public.cabin_trips (status, started_at desc);

-- サーバ (service_role) からだけ読み書きする
alter table public.cabin_devices enable row level security;
alter table public.cabin_trips   enable row level security;

-- ⚡ BOOST 用の曲 (purpose = 'boost') と 開始位置
alter table public.driver_tracks drop constraint if exists driver_tracks_purpose_check;
alter table public.driver_tracks add constraint driver_tracks_purpose_check check (purpose in ('in', 'out', 'boost'));
alter table public.driver_tracks add column if not exists start_sec integer not null default 0;

-- 部屋の写真 (iPad 用)。'builtin:r1'〜'builtin:r4' = 最初から入っている写真 / 'rooms/…' = アップロードした写真
alter table public.rooms add column if not exists cabin_photo text;
-- 写真の上の位置 (%): {"ac":[x,y] | null, "lamp":[x,y], "wifi":[x,y] | null}
alter table public.rooms add column if not exists cabin_spots jsonb;

-- 確認
select 'cabin_devices' as t, count(*) from public.cabin_devices
union all select 'cabin_trips', count(*) from public.cabin_trips;
