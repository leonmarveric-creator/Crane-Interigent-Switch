-- =============================================================================
--  エントランスの位置制限 (離れた場所からの誤解錠を防ぐ)
--   entrances.lat / lng         … エントランスの位置 (NULL = 位置制限なし)
--   entrances.geofence_radius_m … この距離 (m) 以内にいるときだけゲストが解錠できる
--  位置情報はその場の判定だけに使い、保存しない。
--  すべて idempotent。
-- =============================================================================
alter table public.entrances
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists geofence_radius_m integer not null default 100;

do $$ begin
  alter table public.entrances
    add constraint chk_entrances_geofence_radius check (geofence_radius_m between 20 and 2000);
exception when duplicate_object then null; end $$;
