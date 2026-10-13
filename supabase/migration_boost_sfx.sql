-- 車内 iPad の BOOST 起動音 (HIROSHI DRIVE の「車内 iPad」設定で選ぶ)。空なら今までの音を大きくしたもの
alter table public.app_settings add column if not exists boost_sfx text;
notify pgrst, 'reload schema';
