-- 車内 iPad の ASTRAEA の「ユーモアモード」(映画・アニメ・ゲームのオマージュも話す)。
-- お父さんのスマホ (HIROSHI DRIVE の送迎バーの 😂) と AGENT KAKU の設定から切り替える。全部の送迎で共通。
-- 何回実行しても大丈夫です。
alter table public.app_settings add column if not exists ai_humor boolean not null default false;
notify pgrst, 'reload schema';
