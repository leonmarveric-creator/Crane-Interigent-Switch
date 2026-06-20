-- 部屋アート画像のURL/パスを追加
alter table public.rooms
  add column if not exists image_url text;

-- 既定値: /rooms/<slug>.jpg (public/rooms に画像を置く想定)
update public.rooms
  set image_url = '/rooms/' || slug || '.jpg'
  where image_url is null;
