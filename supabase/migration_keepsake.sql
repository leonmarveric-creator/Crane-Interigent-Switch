-- 旅の記念 (GUEST BOARD の招待くじ / Crane Journey ART / Crane Nest Records / Cheers Around the World)
create table if not exists public.keepsake_invites (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique,     -- 1 予約 (1 組) に 1 つ
  token text not null unique,              -- ゲスト用ページ /k/<token> の合言葉
  gifts text[] not null default '{}',      -- art / rec / card
  guest_name text,
  lang text,
  room_kanji text,
  status text not null default 'invited',  -- invited (まだ引いていない) / drawn (引いた)
  drawn_at timestamptz,
  card_given_at timestamptz,               -- カードを手渡しした時刻
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists public.keepsake_orders (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.keepsake_invites(id) on delete cascade,
  kind text not null,                      -- art / rec / cheers
  payload jsonb not null default '{}'::jsonb,
  photo_path text,                         -- ゲストが送った写真 (Storage: keepsake)
  status text not null default 'new',      -- new (作成待ち) / done (お渡し済み)
  result_paths jsonb not null default '[]'::jsonb,  -- 完成品 [{path,name,type}]
  result_link text,                        -- 完成品のリンク (ファイルの代わり)
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);
create index if not exists keepsake_orders_invite on public.keepsake_orders (invite_id);
create table if not exists public.keepsake_examples (
  id uuid primary key default gen_random_uuid(),
  before_path text not null,
  after_path text not null,
  caption text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.keepsake_settings (
  id int primary key default 1,
  cheers_on boolean not null default false, -- Cheers Around the World をゲストに出すか
  cheers_price text,                        -- 料金の表示 (例: ¥5,000)
  cheers_note text                          -- パフォーマーへの支援の説明など
);
insert into public.keepsake_settings (id) values (1) on conflict (id) do nothing;
alter table public.keepsake_invites enable row level security;
alter table public.keepsake_orders enable row level security;
alter table public.keepsake_examples enable row level security;
alter table public.keepsake_settings enable row level security;
-- 写真・完成品の置き場 (非公開。ページからは期限つきのリンクで見る)
insert into storage.buckets (id, name, public) values ('keepsake', 'keepsake', false) on conflict (id) do nothing;
notify pgrst, 'reload schema';
