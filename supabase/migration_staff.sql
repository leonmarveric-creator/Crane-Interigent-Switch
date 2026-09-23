-- =============================================================================
--  スタッフ画面 (/staff) 用
--   reservations.early_checkin_at  … 早期チェックイン時刻 (NULL = 通常どおり)
--   reservations.late_checkout_at  … レイトチェックアウト時刻 (NULL = 通常どおり)
--     ※ Airbnb 同期は check_in / check_out だけを書き換えるので、ここは消えない
--   rooms.cleaned_at               … 最後に「清掃完了」を押した時刻
--  すべて idempotent。
-- =============================================================================
alter table public.reservations
  add column if not exists early_checkin_at timestamptz,
  add column if not exists late_checkout_at timestamptz;

alter table public.rooms
  add column if not exists cleaned_at timestamptz;
