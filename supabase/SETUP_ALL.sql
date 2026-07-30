-- =============================================================================
--  IoT Guest Control — Supabase 初回セットアップ (これ1本を SQL Editor で実行)
--  内容: 基本スキーマ + 全migration(PIN/URL/ウェルカム/ジオフェンス/画像/
--        ログ/PIN試行/テストアラーム/ギャラクシー/和風ライト)
--  すべて idempotent。再実行してもエラーになりません。
--  ※ 部屋データ(seed_rooms.sql)は秘密鍵を含むため含めていません。
--    部屋は管理画面から追加してください。
-- =============================================================================

-- ##### 1. 基本スキーマ (rooms / reservations / alarms / RLS / view) #####
-- =============================================================================
--  IoT Guest Control  /  Supabase (PostgreSQL) Schema
--  Tables: rooms, reservations (iCal + manual hybrid), alarms
--  Run order matters (FK / enum dependencies).
-- =============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- -----------------------------------------------------------------------------
-- ENUMs
-- -----------------------------------------------------------------------------
do $$ begin
  create type reservation_status as enum ('active', 'cancelled', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reservation_source as enum ('ical', 'manual');
exception when duplicate_object then null; end $$;

-- =============================================================================
--  rooms
--  物理的な部屋 + そこに紐づくデバイス資格情報。将来9部屋まで動的拡張。
--  デバイス系の秘匿値はサーバ専用 (RLS で anon からは触らせない)。
-- =============================================================================
create table if not exists public.rooms (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,           -- URLで使う安定キー e.g. "ocean-301"
  display_name      text not null,                  -- 表示名
  is_active         boolean not null default true,

  -- iCal
  airbnb_ical_url   text,                           -- AirbnbのエクスポートiCal URL

  -- Sesame 5 (スマートロック)
  sesame_device_uuid text,                          -- デバイスUUID
  sesame_secret_key  text,                          -- 16byte HEX (CMAC鍵) ※サーバ専用
  sesame_api_key     text,                          -- Web API キー

  -- SwitchBot (赤外線ハブミニ経由の仮想リモコン)
  switchbot_ac_device_id     text,                  -- エアコン (Virtual IR)
  switchbot_light_device_id  text,                  -- 照明 (Virtual IR)
  switchbot_galaxy_device_id text,                  -- ギャラクシー (プラネタリウム / 物理デバイス)
  switchbot_nest_device_id   text,                  -- NEST (藤編みボールランプ / 物理デバイス)
  switchbot_wafu_device_id   text,                  -- 和風ライト/行灯 (スマート電球)
  -- SwitchBotのトークン/シークレットは全部屋共通になりがちなので環境変数で持つ想定。
  -- 部屋ごとに別アカウントなら下記を使用:
  switchbot_token   text,
  switchbot_secret  text,

  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- =============================================================================
--  reservations
--  iCal自動同期と手動追加の両方を1テーブルで許容。
--   - source='ical'  -> airbnb_uid を必ず持つ (差分同期のキー)
--   - source='manual'-> airbnb_uid は NULL
--  guest_token は発行時に一意。期間 + status + token でアクセス制御。
-- =============================================================================
create table if not exists public.reservations (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rooms(id) on delete cascade,

  source        reservation_source not null default 'manual',
  airbnb_uid    text,                               -- iCal VEVENT UID (manualはNULL)

  guest_token   text not null default encode(gen_random_bytes(24), 'hex'),

  -- 滞在期間 (タイムゾーンはUTC保存、表示はAsia/Tokyo)
  check_in      timestamptz not null,
  check_out     timestamptz not null,

  status        reservation_status not null default 'active',

  guest_name    text,                               -- 任意 (手動時に入力可)
  guest_lang    text default 'en',                  -- 初期表示言語 ja/en/zh/ko
  note          text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint chk_dates check (check_out > check_in)
);

-- iCal差分同期のための一意制約 (同一部屋内でUIDは一意)。manual(NULL)は重複可。
create unique index if not exists uq_reservations_room_uid
  on public.reservations (room_id, airbnb_uid)
  where airbnb_uid is not null;

create unique index if not exists uq_reservations_token
  on public.reservations (guest_token);

create index if not exists idx_reservations_room_active
  on public.reservations (room_id, status, check_in, check_out);

-- =============================================================================
--  alarms
--  光目覚まし。予約 (滞在) に紐付け。Cronが fire_at を跨いだ未実行を1回だけ点灯。
-- =============================================================================
create table if not exists public.alarms (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  room_id        uuid not null references public.rooms(id) on delete cascade,

  fire_at        timestamptz not null,              -- 点灯予定時刻 (UTC)
  is_enabled     boolean not null default true,
  triggered_at   timestamptz,                       -- 実行済みなら記録 (二重実行防止)

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_alarms_due
  on public.alarms (fire_at)
  where is_enabled = true and triggered_at is null;

-- =============================================================================
--  updated_at 自動更新トリガ
-- =============================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$ begin
  create trigger trg_rooms_touch        before update on public.rooms
    for each row execute function public.touch_updated_at();
  create trigger trg_reservations_touch before update on public.reservations
    for each row execute function public.touch_updated_at();
  create trigger trg_alarms_touch       before update on public.alarms
    for each row execute function public.touch_updated_at();
exception when duplicate_object then null; end $$;

-- =============================================================================
--  Row Level Security
--  方針: anon / authenticated からの直接アクセスは全て拒否。
--        全ての読み書きは service_role を使うサーバ (API Routes) 経由のみ。
--        => 秘密鍵(sesame_secret_key等)やguest_tokenがクライアントへ漏れない。
-- =============================================================================
alter table public.rooms        enable row level security;
alter table public.reservations enable row level security;
alter table public.alarms       enable row level security;
-- ポリシーを一切作らない = anon/auth からは0行。service_roleはRLSをバイパス。

-- =============================================================================
--  便利ビュー: 「今アクティブな滞在」 (サーバ側の検証補助)
-- =============================================================================
create or replace view public.active_stays as
  select r.*, rm.slug as room_slug, rm.display_name
  from public.reservations r
  join public.rooms rm on rm.id = r.room_id
  where r.status = 'active'
    and now() >= r.check_in
    and now() <  r.check_out;

-- ##### migration: pin #####
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

-- ##### migration: resurl #####
-- 予約に Airbnb 予約ページURL を追加 (管理画面の「Airbnbで開く」用)
alter table public.reservations
  add column if not exists airbnb_reservation_url text;

-- ##### migration: welcome #####
-- ウェルカムシーン実行済みフラグ (初回解錠の自動実行を1滞在1回に抑える)
alter table public.reservations
  add column if not exists welcomed_at timestamptz;

-- ##### migration: geofence #####
-- ジオフェンス: 部屋(建物)の座標と許可半径
alter table public.rooms
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists geofence_radius_m integer default 150;

-- lat/lng が NULL の部屋は位置制限OFF (どこでも操作可) = 既存の挙動。
-- 建物の座標を入れると、その部屋は範囲内のみ操作可能になる。
-- 例: 建物A(4部屋)
-- update public.rooms set lat=35.0000, lng=135.0000, geofence_radius_m=150
--   where slug in ('room-spring','room-summer','room-autumn','room-winter');

-- ##### migration: image #####
-- 部屋アート画像のURL/パスを追加
alter table public.rooms
  add column if not exists image_url text;

-- 既定値: /rooms/<slug>.jpg (public/rooms に画像を置く想定)
update public.rooms
  set image_url = '/rooms/' || slug || '.jpg'
  where image_url is null;

-- ##### migration: logs #####
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

-- ##### migration: pin_attempts #####
-- PINブルートフォース対策: 失敗試行の記録テーブル
-- 一定時間内の失敗回数が閾値を超えたら、その部屋のPIN認証を一時ロックする。
-- RLS有効・ポリシー無し → service_role(サーバ)のみアクセス可能。

create table if not exists pin_attempts (
  id         uuid primary key default gen_random_uuid(),
  room_slug  text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pin_attempts_room_time
  on pin_attempts (room_slug, created_at);

alter table pin_attempts enable row level security;

-- ##### migration: test_alarm #####
-- =============================================================================
--  テスト用 光目覚まし対応
--  管理画面テストページから予約(滞在)なしでアラームを設定できるように
--  reservation_id を NULL 許可にする。
--  実ゲストのアラームは従来どおり reservation_id 付きで動作する。
--  wake-alarm Cron は room_id のみ参照するため挙動は変わらない。
-- =============================================================================
alter table public.alarms
  alter column reservation_id drop not null;

-- ##### migration: galaxy #####
-- ギャラクシーモード: 部屋ごとのプラネタリウムプロジェクター用 SwitchBot デバイス
-- (SwitchBot Bot / Plug Mini 等の物理デバイスでプロジェクターの電源をON/OFF)
alter table rooms
  add column if not exists switchbot_galaxy_device_id text;

comment on column rooms.switchbot_galaxy_device_id is
  'プラネタリウムプロジェクターを操作する SwitchBot デバイスID (null = ギャラクシーモード非対応の部屋)';

-- ##### migration: nest #####
-- NESTモード: 部屋ごとの藤編みボールランプ(間接照明)用 SwitchBot デバイス
alter table rooms
  add column if not exists switchbot_nest_device_id text;

comment on column rooms.switchbot_nest_device_id is
  '藤編みボールランプ(NESTモード)を操作する SwitchBot デバイスID (null = NESTモード非対応の部屋)';

-- ##### migration: wafu #####
-- 和風ライト(行灯): 部屋ごとの SwitchBot スマート電球 (turnOn/turnOff で点灯・消灯)
-- 既存のメイン照明(switchbot_light_device_id, 仮想IR)とは別枠の間接照明。
alter table rooms
  add column if not exists switchbot_wafu_device_id text;

comment on column rooms.switchbot_wafu_device_id is
  '和風ライト(行灯)を操作する SwitchBot デバイスID / スマート電球 (null = 和風ライト非対応の部屋)';
