-- 車内 iPad: 再生中の曲 (歌詞) と、iPad からの再生の操作
--   ・now_playing : お父さんのスマホで流れている曲 { id, pos, dur, on, at }  (3 秒ごとに更新)
--   ・music_cmd   : iPad の再生ボタン { c: toggle|next|prev|seek, v, n }  (スマホが受け取って操作する)
-- 何回実行しても大丈夫です。
-- (アルバムカバーの列も。古いデータベースで無い場合があるので、ここでも足しておく)
alter table public.driver_tracks add column if not exists cover_path text;
alter table public.cabin_trips add column if not exists now_playing jsonb;
alter table public.cabin_trips add column if not exists music_cmd jsonb;
-- 追加した列をすぐ使えるように (API の表の情報を読み直す)
notify pgrst, 'reload schema';
