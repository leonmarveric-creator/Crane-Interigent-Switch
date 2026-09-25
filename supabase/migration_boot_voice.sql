-- =============================================================================
--  ハイテクUI 起動の声の切り替え (管理画面 → ツール → テスト)
--    astralis = 「ASTRALIS system online」 (既定)
--    jarvis   = 「J.A.R.V.I.S online」など従来の 3 種類からランダム
--  1 行だけの設定テーブル。何度実行しても安全。
-- =============================================================================
create table if not exists public.app_settings (
  id          integer primary key default 1 check (id = 1),
  boot_voice  text not null default 'astralis' check (boot_voice in ('astralis', 'jarvis')),
  updated_at  timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- service_role (サーバ) からのみアクセス
alter table public.app_settings enable row level security;
