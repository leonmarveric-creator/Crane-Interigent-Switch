-- 冷房用・暖房用のエアコンを別の SwitchBot 機器として登録している部屋のため
alter table rooms add column if not exists ac_cool_device_id text;
alter table rooms add column if not exists ac_heat_device_id text;
