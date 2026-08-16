-- =========================================================
--  便槽（し尿タンク）モニタリング  ※ Crane Nest から移植
--  自社ゲストハウス専用の内部管理機能。
--
--  水量の考え方（Switch版）:
--    予約から「泊まった夜」を展開し、前回汲み取り日〜今日より前の“過ぎた夜”のみ
--    人数×3.5L/人で積算する。80%（既定480L）超過で WxPusher へ通知。
--
--  予約ソース（tankStore.ts が統合して毎回再計算）:
--    1) 自社/手動予約 … public.reservations の source='manual'
--         （Switch本体の予約テーブル。人数列が無いため既定人数で計算し、
--           実人数がズレた日は stays_tank_logs の手動補正で上書きする）
--    2) Airbnb予約   … stays_ext_reservations（Airbnb確定/キャンセルメールを
--           Gmailから解析して取り込み。人数はメールから検知）
--    ※ source='ical' の予約は Airbnb と二重計上になるためタンク計算から除外する
--       （iCalは施錠/アラーム制御用として従来どおり利用）。
--
--  Supabase 未設定時はアプリ側のインメモリ・モックで動作するため、
--  このマイグレーションは本番運用時に適用する。
--
--  RLS方針: 本プロジェクトの既存方針に合わせ、ポリシーを一切作らない
--           （= anon/authenticated からは0行。service_role はRLSをバイパス）。
-- =========================================================

-- 1. タンクの状態（シングルトン: id=1 の1棟運用。複数棟化する場合は行を増やす）
create table if not exists public.stays_tank_state (
  id                 integer primary key default 1,
  capacity_liters    numeric not null default 600,    -- タンク総容量
  liters_per_guest   numeric not null default 3.5,    -- 1人1日あたり使用量
  last_emptied_date  date    not null default current_date,  -- 前回汲み取り日
  alerted            boolean not null default false,  -- 警告通知済みフラグ（多重通知抑制）
  updated_at         timestamptz not null default now()
);

-- 既定の1行を用意
insert into public.stays_tank_state (id) values (1)
  on conflict (id) do nothing;

-- 2. 手動補正(override)テーブル
--    通常は予約から自動計算するが、実人数がズレた日だけスタッフがこの値で上書きする。
--    ここに行が無い日付は「予約からの自動値」を採用する。
create table if not exists public.stays_tank_logs (
  date        date not null primary key,
  guests      integer not null default 0,   -- 補正後の宿泊人数
  liters      numeric not null default 0,    -- guests * liters_per_guest（参考値）
  created_at  timestamptz not null default now()
);
create index if not exists idx_stays_tank_logs_date on public.stays_tank_logs (date desc);

-- 3. 外部予約（Airbnb等）取り込みテーブル
--    Airbnbの予約確定/キャンセルメールを解析した結果を格納する。
--      - source + code を一意キーにして upsert（同じ予約の確定→キャンセルを追跡）
--      - status を confirmed / cancelled で持ち、キャンセルは計算から自動除外
create table if not exists public.stays_ext_reservations (
  source        text not null default 'airbnb',   -- 取り込み元
  code          text not null,                     -- 予約番号（一意キー）
  guests        integer,                           -- 宿泊人数（メールから抽出、null可）
  check_in      date,                              -- チェックイン
  check_out     date,                              -- チェックアウト
  status        text not null default 'confirmed', -- confirmed / cancelled
  email_id      text,                              -- 取り込み元Gmailメッセージ ID（重複取り込み防止の参考）
  raw_subject   text,                              -- 参考: 解析元の件名
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  primary key (source, code)
);
create index if not exists idx_stays_ext_res_dates  on public.stays_ext_reservations (check_out);
create index if not exists idx_stays_ext_res_status on public.stays_ext_reservations (status);

-- updated_at 自動更新トリガ（Switch既存の public.touch_updated_at() を再利用）
do $$ begin
  create trigger trg_stays_tank_state_updated_at
    before update on public.stays_tank_state
    for each row execute function public.touch_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_stays_ext_res_updated_at
    before update on public.stays_ext_reservations
    for each row execute function public.touch_updated_at();
exception when duplicate_object then null; end $$;

-- RLS: 既存方針どおりポリシーを作らない（service_role のみアクセス可）
alter table public.stays_tank_state       enable row level security;
alter table public.stays_tank_logs        enable row level security;
alter table public.stays_ext_reservations enable row level security;
