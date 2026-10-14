-- 管理画面「LIVE」: SwitchBot から知らせてもらった機器の今の状態 (Webhook)。1 台 1 行 (新しい知らせで上書き)
-- サーバー (service_role) だけが読み書きする。ゲストの画面からは見えない
create table if not exists public.device_state (
  device_id   text primary key,          -- SwitchBot の deviceMac (= deviceId、大文字・区切りなし)
  device_type text,                      -- WoBulb / WoCeiling / WoPlugJP など
  power       text,                      -- ON / OFF
  brightness  int,
  extra       jsonb,                     -- 色温度・色・温度など、そのまま
  updated_at  timestamptz not null default now()
);
alter table public.device_state enable row level security;
notify pgrst, 'reload schema';
