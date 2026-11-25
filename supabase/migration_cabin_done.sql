-- 車内画面: もう済んだこと (案内した場所・お部屋のホログラム・到着の演出・BOOST・出発のあいさつ)
--   iPad ⇄ お父さんのスマホで「動かし役」を引き継いだとき、同じ演出や案内を繰り返さないための記録 (1 回の送迎で数百バイト)
alter table public.cabin_trips add column if not exists done jsonb;
