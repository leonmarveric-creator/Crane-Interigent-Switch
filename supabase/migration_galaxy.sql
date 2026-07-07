-- ギャラクシーモード: 部屋ごとのプラネタリウムプロジェクター用 SwitchBot デバイス
-- (SwitchBot Bot / Plug Mini 等の物理デバイスでプロジェクターの電源をON/OFF)
alter table rooms
  add column if not exists switchbot_galaxy_device_id text;

comment on column rooms.switchbot_galaxy_device_id is
  'プラネタリウムプロジェクターを操作する SwitchBot デバイスID (null = ギャラクシーモード非対応の部屋)';
