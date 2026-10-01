-- 車内 iPad の声をスマホで鳴らしたかどうかの返事 (受け取り確認)
-- スマホは鳴らし始めた声の番号をここに残す。iPad は返事が来なければ、自分で声を鳴らす
-- (スマホの画面が消えている・電話中などで鳴らせないときも、声が消えないように)
-- 何回実行しても大丈夫です。
alter table public.cabin_trips add column if not exists voice_ack bigint;
notify pgrst, 'reload schema';
