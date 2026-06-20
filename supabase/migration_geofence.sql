-- ジオフェンス: 部屋(建物)の座標と許可半径
alter table public.rooms
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists geofence_radius_m integer default 150;

-- lat/lng が NULL の部屋は位置制限OFF (どこでも操作可) = 既存の挙動。
-- 建物の座標を入れると、その部屋は範囲内のみ操作可能になる。
-- 例: 建物A(4部屋)
-- update public.rooms set lat=35.0000, lng=135.0000, geofence_radius_m=150
--   where slug in ('room-spring','room-summer','room-autumn','room-winter');
