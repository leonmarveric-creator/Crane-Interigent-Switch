-- K-OPS (AGENT KAKU の新しい画面): スマホで操作して iPad が動くためのつなぎ
create table if not exists public.kaku_link (
  code text primary key,                 -- iPad に出る 4 けたの番号
  dstate jsonb,                          -- iPad (ミッション画面) の状態
  cstate jsonb,                          -- スマホ (操作パネル) の状態 (位置・再生中の曲)
  updated_at timestamptz not null default now()
);
create table if not exists public.kaku_link_cmd (
  id bigserial primary key,
  code text not null,
  cmd text not null,
  args jsonb,
  at timestamptz not null default now()
);
create index if not exists kaku_link_cmd_code on public.kaku_link_cmd (code, id);
alter table public.kaku_link enable row level security;
alter table public.kaku_link_cmd enable row level security;
notify pgrst, 'reload schema';
