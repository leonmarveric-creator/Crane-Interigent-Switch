-- =============================================================================
-- ゲストのチェックアウト (お部屋の操作画面 / コンシェルジュの「チェックアウトする」)
--   ・reservations.guest_checkout_at … ゲストがチェックアウトした時刻。入ると
--       部屋の操作・鍵は使えなくなる (コンシェルジュの地図・送迎の案内は見られる)
--   ・guest_checkouts … 同意の記録 (スタッフ用・消さない)。
--       同意した文面・言語・確認した項目・電源 OFF の結果・端末を残す
--  idempotent。SQL Editor でそのまま実行してください。
-- =============================================================================
alter table public.reservations
  add column if not exists guest_checkout_at timestamptz;

comment on column public.reservations.guest_checkout_at is
  'ゲストがチェックアウトボタンで退室した時刻 (UTC)。以降は部屋の操作・鍵を止める';

create table if not exists public.guest_checkouts (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid not null references public.reservations(id) on delete cascade,
  room_id         uuid not null references public.rooms(id) on delete cascade,
  checked_out_at  timestamptz not null default now(),
  via             text not null default 'room',     -- room / concierge
  lang            text not null default 'ja',       -- ゲストに表示した言語
  items_total     integer not null default 0,
  items_checked   integer[] not null default '{}',  -- 確認した項目 (番号)
  items_text      text[] not null default '{}',     -- 表示した項目名 (その言語のまま)
  policy_version  text not null,
  policy_text     text not null,                    -- 同意した文面 (その言語のまま)
  agree_text      text not null,
  power_ok        boolean,                          -- 電源 OFF が成功したか
  power_error     text,
  user_agent      text,
  ip              text
);

create unique index if not exists uq_guest_checkouts_reservation
  on public.guest_checkouts (reservation_id);
create index if not exists idx_guest_checkouts_time
  on public.guest_checkouts (checked_out_at desc);

-- サーバー (service_role) だけが読み書きする。ブラウザ (anon) からは見えない
alter table public.guest_checkouts enable row level security;
