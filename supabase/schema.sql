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
