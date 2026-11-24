-- エアコンの暖房・冷房 (部屋ごと) + チェックアウト後の自動 OFF
--   DIY 登録のエアコン: SwitchBot アプリで学習したボタンの名前 (例: 「暖房」「冷房」「停止」) をそのまま入れる
--   ac_policy: auto = 季節 + 外の気温で自動 / cool = いつも冷房 / heat = いつも暖房
alter table public.rooms add column if not exists ac_policy    text not null default 'auto';
alter table public.rooms add column if not exists ac_cool_cmd  text;
alter table public.rooms add column if not exists ac_heat_cmd  text;
alter table public.rooms add column if not exists ac_off_cmd   text;
alter table public.rooms add column if not exists ac_cool_temp int  not null default 26;
alter table public.rooms add column if not exists ac_heat_temp int  not null default 23;
-- チェックアウトボタンが押されなかった部屋を自動で OFF にした時刻 (二重に動かないように)
alter table public.reservations add column if not exists auto_off_at timestamptz;
