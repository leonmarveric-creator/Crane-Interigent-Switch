-- AGENT KAKU の曲にアルバムカバーを付ける (画像は Storage driver-music の kaku/ に入ります)
alter table public.kaku_tracks add column if not exists cover_path text;
notify pgrst, 'reload schema';
