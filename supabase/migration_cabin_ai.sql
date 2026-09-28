-- 車内 iPad の AI「ASTRAEA」: 静かモード (お父さんのスマホで切り替え。オンの間は AI のひと言を止める。道案内はそのまま)
-- 何回実行しても大丈夫です。
alter table public.cabin_trips add column if not exists ai_quiet boolean not null default false;
notify pgrst, 'reload schema';
-- ASTRAEA への指示 (お父さんのスマホのボタン・声 → iPad)
alter table public.cabin_trips add column if not exists ai_cmd jsonb;
-- チェックイン QR の画像 (全員共通。Storage driver-music の cabin/ の中)
alter table public.app_settings add column if not exists cabin_checkin_qr text;
notify pgrst, 'reload schema';
