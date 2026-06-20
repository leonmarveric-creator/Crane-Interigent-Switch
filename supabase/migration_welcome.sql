-- ウェルカムシーン実行済みフラグ (初回解錠の自動実行を1滞在1回に抑える)
alter table public.reservations
  add column if not exists welcomed_at timestamptz;
