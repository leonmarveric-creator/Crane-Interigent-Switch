-- 車内 iPad の声 (ASTRAEA・道案内) を、Bluetooth でつながっているスマホから流す
-- iPad が話す内容を順番に置き、スマホ (HIROSHI DRIVE / AGENT KAKU) が 1 秒ごとに取りに来て鳴らす
-- 何回実行しても大丈夫です。
alter table public.cabin_trips add column if not exists voice_q jsonb;
alter table public.cabin_trips add column if not exists voice_seen timestamptz;
notify pgrst, 'reload schema';
-- 回送モード (ゲストが乗っていない区間): dead = 迎えに行く途中 / お見送りのあとの帰り道、guest = ゲストが乗っている
alter table public.cabin_trips add column if not exists phase text not null default 'guest';
notify pgrst, 'reload schema';
