-- 和風ライト(行灯): 部屋ごとの SwitchBot スマート電球 (turnOn/turnOff で点灯・消灯)
-- 既存のメイン照明(switchbot_light_device_id, 仮想IR)とは別枠の間接照明。
alter table rooms
  add column if not exists switchbot_wafu_device_id text;

comment on column rooms.switchbot_wafu_device_id is
  '和風ライト(行灯)を操作する SwitchBot デバイスID / スマート電球 (null = 和風ライト非対応の部屋)';
