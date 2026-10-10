-- =============================================================================
-- 「みんなの声」: チェックアウトの最後にゲストが選んで送るひとこと (お母さんの画面に流す)
--   ・言葉は番号 (a / b / c) で保存。文は lib/cheerText.ts の前向きな言葉だけ
--   ・自由に書いた言葉 (free_text) は、管理画面で承認したものだけ流す
--   ・何も選ばなかったゲストも 1 行 (kind = 'none') →「平安 踏上 旅途」と流す
--  idempotent。SQL Editor でそのまま実行してください。
-- =============================================================================
create table if not exists public.guest_cheers (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid not null references public.reservations(id) on delete cascade,
  room_id         uuid references public.rooms(id) on delete set null,
  created_at      timestamptz not null default now(),
  guest_name      text,
  country         text,                    -- ISO 2 文字 (例 IT)
  lang            text not null default 'en', -- 届ける言葉 (国の言葉)
  kind            text not null default 'words', -- words / none
  a               smallint,                -- ありがとう (番号)
  b               smallint,                -- よかったこと
  c               smallint,                -- これから
  free_text       text,                    -- 自由に書いた言葉 (承認するまで流さない)
  free_zh         text,                    -- その中文訳 (管理画面で入れる)
  free_status     text not null default 'none', -- none / pending / approved / hidden
  seen_at         timestamptz              -- お母さんが見た時刻 (新しい声のお知らせ用)
);

create unique index if not exists uq_guest_cheers_reservation on public.guest_cheers (reservation_id);
create index if not exists idx_guest_cheers_time on public.guest_cheers (created_at desc);

-- サーバー (service_role) だけが読み書きする
alter table public.guest_cheers enable row level security;
