-- =============================================================================
-- 早朝便の自動光目覚まし
--   ・alarms.source … guest (ゲストが自分で) / auto (送迎予約から自動) / auto_edited (自動をゲストが時間変更)
--   ・reservations.wake_auto_off … ゲストが「使わない」を押した (自動で作り直さない)
--  idempotent。SQL Editor でそのまま実行してください。
-- =============================================================================
alter table public.alarms
  add column if not exists source text not null default 'guest';

alter table public.reservations
  add column if not exists wake_auto_off boolean not null default false;
