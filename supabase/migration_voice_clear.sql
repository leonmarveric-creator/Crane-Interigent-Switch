-- アストレアの声を聞き取りやすくする範囲 (お父さんのスマホの「車内 iPad」設定で選ぶ)
--   boost = BOOST のときだけ (空のときもこれ) / all = いつも / off = 使わない
alter table public.app_settings add column if not exists voice_clear text;
notify pgrst, 'reload schema';
