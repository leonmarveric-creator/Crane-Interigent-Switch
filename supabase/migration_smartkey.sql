-- =============================================================================
--  スマートキー（メインエントランス）
--   entrances          … 棟ごとのエントランス Sesame と、ゲスト画面に出す情報
--   smartkey_settings  … ゲスト鍵画面の設定 + 緊急停止（1行だけ）
--   entrance_logs      … 本人確認・解錠・施錠の記録
--   reservations.entrance_name / entrance_verified_at … ゲストが入力した名前
--  すべて idempotent。RLS有効・ポリシー無し → service_role(サーバ)のみアクセス可。
-- =============================================================================

create table if not exists public.entrances (
  id                 uuid primary key default gen_random_uuid(),
  slug               text unique not null,            -- QR/URLのキー e.g. "crane-nest"
  display_name       text not null,                   -- 例: "Crane Nest エントランス"
  building           text not null,                   -- rooms.building と同じ値 (この棟の予約だけ通す)
  is_active          boolean not null default true,

  -- エントランスの Sesame (秘密情報はサーバ専用)
  sesame_device_uuid text,
  sesame_secret_key  text,                            -- 16byte HEX
  sesame_api_key     text,                            -- 空なら環境変数 SESAME_API_KEY

  -- ゲスト画面に表示する情報 (任意)
  keypad_code        text,                            -- テンキー用の暗証番号
  wifi_ssid          text,
  wifi_password      text,
  support_url        text,                            -- LINE / WhatsApp / tel: など

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_entrances_building on public.entrances (building);

create table if not exists public.smartkey_settings (
  id                 integer primary key default 1 check (id = 1),
  app_unlock_enabled boolean not null default true,   -- false = 緊急停止中 (全物件のアプリ解錠を停止)
  hold_ms            integer not null default 1200 check (hold_ms between 500 and 3000),
  countdown_sec      integer not null default 8   check (countdown_sec between 3 and 60),
  show_lock_now      boolean not null default true,
  show_keypad_code   boolean not null default true,
  show_wifi          boolean not null default true,
  show_support       boolean not null default true,
  updated_at         timestamptz not null default now()
);
insert into public.smartkey_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.entrance_logs (
  id             uuid primary key default gen_random_uuid(),
  entrance_id    uuid references public.entrances(id) on delete cascade,
  room_id        uuid references public.rooms(id) on delete set null,
  reservation_id uuid,
  guest_name     text,
  action         text not null,       -- verify / verify_fail / unlock / lock / room_unlock / room_lock / stop / resume
  source         text not null default 'guest',   -- guest / admin
  success        boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists idx_entrance_logs_created on public.entrance_logs (created_at desc);
create index if not exists idx_entrance_logs_res on public.entrance_logs (reservation_id, created_at desc);

alter table public.reservations
  add column if not exists entrance_name text,
  add column if not exists entrance_verified_at timestamptz;

do $$ begin
  create trigger trg_entrances_touch before update on public.entrances
    for each row execute function public.touch_updated_at();
exception when duplicate_object then null; end $$;

alter table public.entrances         enable row level security;
alter table public.smartkey_settings enable row level security;
alter table public.entrance_logs     enable row level security;

-- 解錠後の施錠方法 (ドアごと): timer=◯秒後 / sensor=ドアを閉めると(オープンセンサー) / off=自動施錠しない
alter table public.smartkey_settings
  add column if not exists entrance_lock text not null default 'timer',
  add column if not exists room_lock     text not null default 'timer';
do $$ begin
  alter table public.smartkey_settings
    add constraint chk_smartkey_lock_modes
    check (entrance_lock in ('timer','sensor','off') and room_lock in ('timer','sensor','off'));
exception when duplicate_object then null; end $$;
