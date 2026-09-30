-- AGENT KAKU: ミッション中の曲に歌詞 (LRC) を付ける
alter table public.kaku_tracks add column if not exists lrc text;
notify pgrst, 'reload schema';
