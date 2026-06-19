-- 予約に Airbnb 予約ページURL を追加 (管理画面の「Airbnbで開く」用)
alter table public.reservations
  add column if not exists airbnb_reservation_url text;
