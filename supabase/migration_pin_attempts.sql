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
