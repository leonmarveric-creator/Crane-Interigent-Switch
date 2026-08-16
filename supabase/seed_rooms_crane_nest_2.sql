-- =============================================================================
--  Crane Nest 2 の5部屋（松・竹・梅・林・荷）を一括登録
--  ※ 先に migration_building.sql を適用しておくこと（building 列が必要）。
--  ※ セサミ/SwitchBot の各deviceは未取得のため NULL。
--     後から管理画面の各部屋カード、または UPDATE で設定する。
--  ※ 部屋アートは動画（public/rooms/<slug>.mp4）。image_url が .mp4 なら
--     ゲスト画面・管理サムネイルとも自動で <video> ループ再生になる。
-- =============================================================================
insert into public.rooms (slug, display_name, building, image_url, is_active) values
  ('room-matsu',   '松', 'Crane Nest 2', '/rooms/room-matsu.mp4',   true),
  ('room-take',    '竹', 'Crane Nest 2', '/rooms/room-take.mp4',    true),
  ('room-ume',     '梅', 'Crane Nest 2', '/rooms/room-ume.mp4',     true),
  ('room-hayashi', '林', 'Crane Nest 2', '/rooms/room-hayashi.mp4', true),
  ('room-ni',      '荷', 'Crane Nest 2', '/rooms/room-ni.mp4',      true)
on conflict (slug) do update
  set display_name = excluded.display_name,
      building     = excluded.building,
      image_url    = excluded.image_url;

-- 確認
select slug, display_name, building, image_url,
       sesame_device_uuid is not null as has_lock
from public.rooms order by building, slug;
