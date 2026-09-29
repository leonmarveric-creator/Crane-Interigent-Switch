-- AGENT KAKU (Kaku さん専用のミッション画面 /kaku)
-- 何回実行しても大丈夫です。
-- 行ったことのある場所 (お気に入り・何回目か)
create table if not exists public.kaku_places (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  lat double precision not null,
  lng double precision not null,
  type text,
  fav boolean not null default false,
  visits int not null default 0,
  last_at timestamptz,
  created_at timestamptz not null default now()
);
-- ミッションの記録
create table if not exists public.kaku_missions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'free',
  type text,
  stops jsonb,
  km numeric(8,2) not null default 0,
  sec int not null default 0,
  kept int,
  rank text,
  started_at timestamptz,
  ended_at timestamptz not null default now()
);
create index if not exists kaku_missions_ended on public.kaku_missions (ended_at desc);
alter table public.kaku_places enable row level security;
alter table public.kaku_missions enable row level security;
-- ミッション中の BGM (Storage driver-music の kaku/ の中。未設定なら内蔵の BGM)
alter table public.app_settings add column if not exists kaku_bgm_normal text;
alter table public.app_settings add column if not exists kaku_bgm_cruise text;
alter table public.app_settings add column if not exists kaku_bgm_boot text;
notify pgrst, 'reload schema';
-- ミッション中のプレイリスト (起動 / ノーマル / クルーズ に何曲でも)
create table if not exists public.kaku_tracks (
  id uuid primary key default gen_random_uuid(),
  which text not null check (which in ('boot','normal','cruise')),
  title text not null,
  path text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists kaku_tracks_which on public.kaku_tracks (which, sort);
alter table public.kaku_tracks enable row level security;
notify pgrst, 'reload schema';
