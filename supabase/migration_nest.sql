-- NESTモード: 部屋ごとの藤編みボールランプ(間接照明)用 SwitchBot デバイス
-- (SwitchBot Bot / Plug Mini 等の物理デバイスでランプの電源をON/OFF)
alter table rooms
  add column if not exists switchbot_nest_device_id text;

comment on column rooms.switchbot_nest_device_id is
  '藤編みボールランプ(NESTモード)を操作する SwitchBot デバイスID (null = NESTモード非対応の部屋)';
