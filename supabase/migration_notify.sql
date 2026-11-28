-- =============================================================================
--  WxPusher のお知らせ (送迎の内容・便槽・自動 ON/OFF・鍵の電池) の送り先と、送った記録。何度実行しても安全。
--   ・app_settings.wx_recipients: 送り先の一覧 (名前・UID・言語・どのお知らせを受け取るか)。管理画面 → ツール で設定
--   ・app_settings.wx_trip_min  : 送迎の何分前に知らせるか (ふだん 30 分)
--   ・notify_log                : 同じお知らせを 2 回送らないための記録
--  ※ 先に migration_boot_voice.sql (app_settings) を実行しておくこと。
-- =============================================================================
alter table public.app_settings add column if not exists wx_recipients jsonb;
alter table public.app_settings add column if not exists wx_trip_min integer;

create table if not exists public.notify_log (
  key text primary key,
  sent_at timestamptz not null default now()
);
alter table public.notify_log enable row level security;
-- 90 日より前の記録は消してよい (任意): delete from public.notify_log where sent_at < now() - interval '90 days';
