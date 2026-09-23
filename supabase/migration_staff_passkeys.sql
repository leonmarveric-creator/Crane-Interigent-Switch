-- =============================================================================
--  スタッフ画面 (/staff) の Face ID / 指紋ログイン (パスキー / WebAuthn)
--   顔や指紋のデータはスマホから出ない。ここには「公開鍵」だけを保存する。
--   端末をなくしたときは、スタッフ画面の「记录」タブ下 or この表の行を削除すれば無効になる。
--  すべて idempotent。
-- =============================================================================
create table if not exists public.staff_passkeys (
  id            text primary key,                 -- credential ID (base64url)
  public_key    text not null,                    -- 公開鍵 (base64url)
  counter       bigint not null default 0,
  transports    text[] not null default '{}',
  device_name   text,                             -- 例: "iPhone"
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

alter table public.staff_passkeys enable row level security;  -- service_role だけが読み書き (ポリシーなし = 拒否)
